import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { getGallaudetApi } from "../lib/gallaudet-api";
import type { GetTaskResponseContent } from "gallaudet-api-typescript-react-query-hooks";
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks";
import { CognitoAuthGate } from "./cognito-auth-gate";
import type { AuthUser } from "../hooks/use-auth";
import { startCognitoOAuthFlowViaPopup } from "../lib/auth-utils";

type TaskViewProps = {
  audience: "student" | "teacher";
};

type TaskViewAuthorizedProps = {
  audience: TaskViewProps["audience"];
  taskId: string | null;
  loginHint?: string;
  user: AuthUser | null;
  signOut: () => Promise<void>;
};

const DEFAULT_ASSET_ROTATION_MS = 5000;
const DEFAULT_GIF_ROTATION_MS = 8000;
const MIN_GIF_FRAME_DELAY_CS = 2;

const formatAudienceLabel = (audience: "student" | "teacher") =>
  audience === "teacher" ? "Teacher Preview" : "Student Assignment";

const parseGifDurationMs = (buffer: ArrayBuffer): number | null => {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 13) {
    return null;
  }

  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  if (signature !== "GIF") {
    return null;
  }

  let offset = 6;
  offset += 7;
  if (offset > bytes.length) {
    return null;
  }

  const packedField = bytes[10] ?? 0;
  if ((packedField & 0x80) !== 0) {
    const globalColorTableSize = 3 * (2 ** ((packedField & 0x07) + 1));
    offset += globalColorTableSize;
  }

  let totalDelayMs = 0;
  let pendingFrameDelayCs: number | null = null;

  while (offset < bytes.length) {
    const blockIntroducer = bytes[offset++];
    if (blockIntroducer === 0x3b) {
      break;
    }

    if (blockIntroducer === 0x21) {
      const extensionLabel = bytes[offset++];
      if (extensionLabel === 0xf9) {
        const blockSize = bytes[offset++];
        if (blockSize !== 4) {
          offset += blockSize;
          continue;
        }
        offset += 1;
        const delayLow = bytes[offset++] ?? 0;
        const delayHigh = bytes[offset++] ?? 0;
        pendingFrameDelayCs = delayLow + (delayHigh << 8);
        offset += 1;
        offset += 1;
        continue;
      }

      while (offset < bytes.length) {
        const subBlockLength = bytes[offset++] ?? 0;
        if (subBlockLength === 0) {
          break;
        }
        offset += subBlockLength;
      }
      continue;
    }

    if (blockIntroducer === 0x2c) {
      offset += 8;
      const localPackedField = bytes[offset++] ?? 0;
      if ((localPackedField & 0x80) !== 0) {
        const localColorTableSize = 3 * (2 ** ((localPackedField & 0x07) + 1));
        offset += localColorTableSize;
      }

      offset += 1;
      while (offset < bytes.length) {
        const imageDataLength = bytes[offset++] ?? 0;
        if (imageDataLength === 0) {
          break;
        }
        offset += imageDataLength;
      }

      const frameDelayCs = pendingFrameDelayCs ?? 10;
      totalDelayMs += Math.max(frameDelayCs, MIN_GIF_FRAME_DELAY_CS) * 10;
      pendingFrameDelayCs = null;
    }
  }

  return totalDelayMs > 0 ? totalDelayMs : null;
};

type RobloxLinkStep = {
  id: string;
  label: string;
  messageType:
    | "google-signin-complete"
    | "google-oauth-scopes-received"
    | "roblox-sign-in-complete";
  completed: boolean;
};

const createRobloxLinkSteps = (): RobloxLinkStep[] => [
  {
    id: "google-signin",
    label: "Google sign-in",
    messageType: "google-signin-complete",
    completed: false,
  },
  {
    id: "oauth-scopes",
    label: "Classroom access",
    messageType: "google-oauth-scopes-received",
    completed: false,
  },
  {
    id: "roblox-link",
    label: "Roblox link",
    messageType: "roblox-sign-in-complete",
    completed: false,
  },
];

const TaskViewAuthorized = ({
  audience,
  taskId,
  loginHint,
  user,
  signOut,
}: TaskViewAuthorizedProps) => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [task, setTask] = useState<GetTaskResponseContent["task"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [robloxLinkStatus, setRobloxLinkStatus] = useState<
    "idle" | "loading" | "linked" | "unlinked" | "error"
  >("idle");
  const [robloxLinkMessage, setRobloxLinkMessage] = useState<string | null>(
    null,
  );
  const [linkingSteps, setLinkingSteps] = useState<RobloxLinkStep[]>(
    createRobloxLinkSteps,
  );
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasAttemptedRobloxLink, setHasAttemptedRobloxLink] = useState(false);
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null,
  );
  const [hasAppliedAutoMilestoneSelection, setHasAppliedAutoMilestoneSelection] =
    useState(false);
  const [gifDurationsByAssetId, setGifDurationsByAssetId] = useState<
    Record<string, number>
  >({});
  const [isLoadedContentVisible, setIsLoadedContentVisible] = useState(false);

  const taskAssets = useMemo(
    () => (status === "success" && task?.assets ? task.assets : []),
    [status, task],
  );
  const selectedMilestone = useMemo(() => {
    if (!task?.milestones || !selectedMilestoneId) {
      return null;
    }

    return (
      task.milestones.find((milestone) => milestone.id === selectedMilestoneId) ??
      null
    );
  }, [selectedMilestoneId, task?.milestones]);

  const visibleAssetIds = useMemo(() => {
    if (selectedMilestone) {
      return selectedMilestone.assetIds ?? [];
    }

    return task?.assetIds ?? [];
  }, [selectedMilestone, task?.assetIds]);

  const visibleAssets = useMemo(() => {
    if (taskAssets.length === 0 || visibleAssetIds.length === 0) {
      return [];
    }

    const assetsById = new Map(taskAssets.map((asset) => [asset.assetId, asset]));
    return visibleAssetIds
      .map((assetId) => assetsById.get(assetId))
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
  }, [taskAssets, visibleAssetIds]);

  useEffect(() => {
    let isCancelled = false;

    if (!taskId) {
      setTask(null);
      setStatus("error");
      setErrorMessage("Missing task identifier in the URL.");
      return;
    }

    const loadTask = async () => {
      setStatus("loading");
      setErrorMessage(null);
      setTask(null);

      try {
        const api = await getGallaudetApi();
        const response = await api.getTask({ taskId });
        if (isCancelled) {
          return;
        }
        setTask(response.task);
        setStatus("success");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        let message = "Unable to load task.";

        if (error instanceof ResponseError) {
          const statusCode = error.response.status;
          let responseMessage: string | undefined;
          try {
            const data = await error.response.clone().json();
            if (typeof data?.message === "string") {
              responseMessage = data.message;
            }
          } catch {
            // Ignore parse failures, rely on fallback messaging.
          }

          if (statusCode === 403) {
            message =
              responseMessage ??
              "You are not authorized to view this Classroom task.";
          } else if (statusCode === 404) {
            message = responseMessage ?? "We could not find this Classroom task.";
          } else {
            message =
              responseMessage ??
              "Failed to verify your Google Classroom context. Please try again.";
          }
        } else if (error instanceof Error && error.message) {
          message = error.message;
        }

        setTask(null);
        setStatus("error");
        setErrorMessage(message);
      }
    };

    loadTask();

    return () => {
      isCancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    setActiveAssetIndex(0);
  }, [taskId, visibleAssets.length, selectedMilestoneId]);

  useEffect(() => {
    setSelectedMilestoneId(null);
    setHasAppliedAutoMilestoneSelection(false);
  }, [taskId]);

  useEffect(() => {
    if (status === "loading") {
      setIsLoadedContentVisible(false);
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      setIsLoadedContentVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [status, taskId]);

  useEffect(() => {
    if (hasAppliedAutoMilestoneSelection) {
      return;
    }
    if (status !== "success" || !task) {
      return;
    }
    if (selectedMilestoneId) {
      setHasAppliedAutoMilestoneSelection(true);
      return;
    }

    const taskLevelAssetIds = task.assetIds ?? [];
    if (taskLevelAssetIds.length > 0) {
      setHasAppliedAutoMilestoneSelection(true);
      return;
    }

    const firstMilestone = task.milestones?.[0];
    if (!firstMilestone?.assetIds?.length) {
      setHasAppliedAutoMilestoneSelection(true);
      return;
    }

    const availableAssetIds = new Set(taskAssets.map((asset) => asset.assetId));
    const hasDisplayableMilestoneAsset = firstMilestone.assetIds.some((assetId) =>
      availableAssetIds.has(assetId),
    );

    if (hasDisplayableMilestoneAsset) {
      setSelectedMilestoneId(firstMilestone.id);
    }
    setHasAppliedAutoMilestoneSelection(true);
  }, [
    hasAppliedAutoMilestoneSelection,
    selectedMilestoneId,
    status,
    task,
    taskAssets,
  ]);

  useEffect(() => {
    if (!taskAssets.length) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadGifDurations = async () => {
      for (const asset of taskAssets) {
        if (asset.contentType !== "image/gif") {
          continue;
        }
        if (gifDurationsByAssetId[asset.assetId]) {
          continue;
        }

        try {
          const response = await fetch(asset.url, {
            signal: controller.signal,
          });
          if (!response.ok) {
            continue;
          }
          const buffer = await response.arrayBuffer();
          if (cancelled) {
            return;
          }
          const parsedDuration = parseGifDurationMs(buffer);
          const resolvedDuration =
            parsedDuration && parsedDuration > 0
              ? parsedDuration
              : DEFAULT_GIF_ROTATION_MS;
          setGifDurationsByAssetId((prev) => ({
            ...prev,
            [asset.assetId]: resolvedDuration,
          }));
        } catch {
          if (cancelled || controller.signal.aborted) {
            return;
          }
        }
      }
    };

    void loadGifDurations();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [taskAssets, gifDurationsByAssetId]);

  useEffect(() => {
    if (visibleAssets.length <= 1) {
      return;
    }

    const currentAsset = visibleAssets[activeAssetIndex];
    const rotationMs =
      currentAsset?.contentType === "image/gif"
        ? (gifDurationsByAssetId[currentAsset.assetId] ??
          DEFAULT_GIF_ROTATION_MS)
        : DEFAULT_ASSET_ROTATION_MS;

    const timerId = window.setTimeout(() => {
      setActiveAssetIndex((previousIndex) =>
        previousIndex + 1 >= visibleAssets.length ? 0 : previousIndex + 1,
      );
    }, rotationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activeAssetIndex, gifDurationsByAssetId, visibleAssets]);

  const refreshRobloxLinkStatus = useCallback(
    async (options?: { cancelled?: () => boolean }) => {
      if (audience !== "student") {
        return;
      }
      const shouldCancel = options?.cancelled ?? (() => false);

      setRobloxLinkStatus("loading");
      setRobloxLinkMessage(null);

      try {
        const api = await getGallaudetApi();
        await api.getLinkedRobloxAccount({});
        if (shouldCancel()) {
          return;
        }

        setRobloxLinkStatus("linked");
        setLinkingSteps((prev) =>
          prev.map((step) => ({ ...step, completed: true })),
        );
      } catch (error) {
        if (shouldCancel()) {
          return;
        }

        let message = "Unable to verify Roblox link status.";

        if (error instanceof ResponseError) {
          const statusCode = error.response.status;
          try {
            const data = await error.response.clone().json();
            if (typeof data?.message === "string") {
              message = data.message;
            }
          } catch {
            // Ignore parse failures and fall back to the default message.
          }

          if (statusCode === 400 && message === "Roblox account not linked") {
            setRobloxLinkStatus("unlinked");
            setRobloxLinkMessage(null);
            return;
          }

          if (statusCode === 403) {
            setRobloxLinkStatus("error");
            setRobloxLinkMessage(
              message ??
                "You must be signed in to verify your Roblox link.",
            );
            return;
          }
        } else if (error instanceof Error && error.message) {
          message = error.message;
        }

        setRobloxLinkStatus("error");
        setRobloxLinkMessage(message);
      }
    },
    [audience],
  );

  useEffect(() => {
    if (audience !== "student") {
      return;
    }

    let isCancelled = false;
    void refreshRobloxLinkStatus({ cancelled: () => isCancelled });

    return () => {
      isCancelled = true;
    };
  }, [audience, refreshRobloxLinkStatus]);

  const resetRobloxSteps = useCallback(() => {
    setLinkingSteps(createRobloxLinkSteps());
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      const { type } = data as { type?: string };

      if (
        type === "google-signin-complete" ||
        type === "google-oauth-scopes-received" ||
        type === "roblox-sign-in-complete"
      ) {
        setLinkingSteps((prevSteps) =>
          prevSteps.map((step) =>
            step.messageType === type ? { ...step, completed: true } : step,
          ),
        );
      }

      if (type === "cognito-auth-complete") {
        setIsPopupOpen(false);
        if (data.ok) {
          setRobloxLinkMessage(null);
          void refreshRobloxLinkStatus();
        } else {
          setRobloxLinkStatus("error");
          setRobloxLinkMessage(
            "We couldn't finish linking your accounts. Please try again.",
          );
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshRobloxLinkStatus]);

  const handleRobloxLogin = () => {
    setHasAttemptedRobloxLink(true);
    setRobloxLinkMessage(null);
    resetRobloxSteps();
    const postAuthRedirectPath =
      `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const popup = startCognitoOAuthFlowViaPopup({
      includeRobloxAssociation: true,
      roleOverride: "student",
      loginHint,
      postAuthRedirectPath,
    });
    if (popup) {
      setIsPopupOpen(true);
      popup.focus();
    } else {
      setIsPopupOpen(false);
      setRobloxLinkMessage(
        "We couldn't open a sign-in popup. Please allow popups in your browser and try again.",
      );
    }
  };

  const headerTitle = useMemo(() => {
    if (status === "success" && task) {
      return task.title;
    }
    if (status === "error") {
      return "Task unavailable";
    }
    if (status === "loading") {
      return "Loading task...";
    }
    return "Task viewer";
  }, [status, task]);

  const headerSubheading = useMemo(() => {
    if (status === "success" && task) {
      return task.subheading;
    }
    if (status === "error") {
      return errorMessage ?? "Something went wrong while retrieving the task.";
    }
    if (status === "loading") {
      return "We’re reaching out to Google Classroom for the latest details.";
    }
    return "Review the assignment details below.";
  }, [status, task, errorMessage]);

  const instructionsContent = useMemo(() => {
    if (status === "loading") {
      return (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      );
    }

    if (status === "error") {
      return (
        <p
          className={`text-red-600 transition-all duration-300 ease-out ${
            isLoadedContentVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-1 opacity-0"
          }`}
        >
          {errorMessage ??
            "Something went wrong while attempting to display this task."}
        </p>
      );
    }

    if (status === "success" && task) {
      return (
        <p
          className={`text-slate-600 leading-relaxed transition-all duration-300 ease-out ${
            isLoadedContentVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-1 opacity-0"
          }`}
        >
          {task.instructions}
        </p>
      );
    }

    return (
      <p className="text-slate-600">
        Provide a task identifier in the URL to see assignment details.
      </p>
    );
  }, [status, task, errorMessage, isLoadedContentVisible]);

  const experienceDisplay = useMemo(() => {
    if (status === "success" && task) {
      return task.experienceName;
    }
    if (status === "loading") {
      return "Loading experience…";
    }
    return "Unknown experience";
  }, [status, task]);

  const robloxLink = useMemo(() => {
    if (status === "success" && task?.robloxGameId) {
      return `https://www.roblox.com/games/${task.robloxGameId}`;
    }
    return null;
  }, [status, task]);

  const currentTaskAsset =
    visibleAssets.length > 0 ? visibleAssets[activeAssetIndex] : null;

  const allRobloxStepsComplete = linkingSteps.every((step) => step.completed);
  const currentRobloxStepIndex = linkingSteps.findIndex(
    (step) => !step.completed,
  );
  const shouldShowRobloxProgress =
    (hasAttemptedRobloxLink || isPopupOpen) && !allRobloxStepsComplete;
  const shouldShowRobloxWarning =
    audience === "student" && robloxLinkStatus === "unlinked";
  const loginInProgress = isPopupOpen && currentRobloxStepIndex > 0;
  const additionalRobloxNote =
    robloxLinkMessage && robloxLinkMessage !== "Roblox account not linked"
      ? robloxLinkMessage
      : null;

  const robloxProgressIndicator = shouldShowRobloxProgress ? (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {linkingSteps.map((step, index) => {
        const isActive = index === currentRobloxStepIndex;
        const isComplete = step.completed;

        return (
          <div
            key={step.id}
            className="flex items-center gap-1 rounded-full bg-white/60 px-2 py-1 ring-1 ring-amber-100"
          >
            {isComplete ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : isActive ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <Circle className="h-3 w-3 text-slate-300" />
            )}
            <span
              className={
                isComplete
                  ? "text-slate-800"
                  : isActive
                    ? "text-slate-700"
                    : "text-slate-400"
              }
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between rounded-lg border bg-white/70 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            {user?.picture && (
              <img
                src={user.picture || "/placeholder.svg"}
                alt={user?.name || "User avatar"}
                className="h-8 w-8 rounded-full"
              />
            )}
            <div>
              <p className="text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>

        {audience === "student" && robloxLinkStatus === "loading" && (
          <Alert className="border-amber-100 bg-amber-50">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            <AlertTitle>Checking your Roblox link…</AlertTitle>
            <AlertDescription>
              <p className="text-slate-700">
                Hang tight while we confirm your Roblox account is connected.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {(shouldShowRobloxWarning ||
          (audience === "student" && robloxLinkStatus === "error")) && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangle className="text-amber-500" />
            <AlertTitle>Link your Roblox account</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                In order to get credit in Google Classroom™ for tasks completed
                in Roblox, you'll first need to link your Roblox account. If you
                don't have a Roblox account, you can create one and come back
                here once you're done.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={handleRobloxLogin}
                  disabled={isPopupOpen}
                >
                  {isPopupOpen ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {loginInProgress ? "Continue in popup..." : "Opening..."}
                    </>
                  ) : (
                    "Login with Roblox"
                  )}
                </Button>
                {robloxProgressIndicator}
              </div>
              {additionalRobloxNote && (
                <p className="text-xs text-amber-800">{additionalRobloxNote}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="uppercase tracking-wide">
                {formatAudienceLabel(audience)}
              </Badge>
              <CardTitle className="mt-3 text-3xl font-semibold text-slate-900">
                {status === "loading" ? (
                  <Skeleton className="h-9 w-full max-w-[40rem]" />
                ) : (
                  <span
                    className={`block transition-all duration-300 ease-out ${
                      isLoadedContentVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-1 opacity-0"
                    }`}
                  >
                    {headerTitle}
                  </span>
                )}
              </CardTitle>
              <p className="mt-2 text-base text-slate-600">
                {status === "loading" ? (
                  <Skeleton className="h-4 w-full max-w-[24rem]" />
                ) : (
                  <span
                    className={`block transition-all duration-300 ease-out ${
                      isLoadedContentVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-1 opacity-0"
                    }`}
                  >
                    {headerSubheading}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-slate-500 md:items-end">
              <span>
                <strong>Partner:</strong>{" "}
                {status === "loading" ? (
                  <Skeleton className="inline-block h-4 w-44 align-middle" />
                ) : (
                  <span
                    className={`inline-block transition-all duration-300 ease-out ${
                      isLoadedContentVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-1 opacity-0"
                    }`}
                  >
                    {experienceDisplay}
                  </span>
                )}
              </span>
              {taskId && (
                <span className="font-mono text-xs text-slate-400">
                  Task ID: {taskId}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-[2fr,1fr] md:gap-8">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-800">
                  Instructions
                </h2>
                {instructionsContent}
                {status === "success" &&
                  task?.milestones &&
                  task.milestones.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-slate-800">
                        Mission Checklist
                      </h3>
                      <ul className="space-y-2">
                        {task.milestones.map((milestone) => (
                          <li
                            key={milestone.id}
                            className={
                              selectedMilestoneId === milestone.id
                                ? "flex items-center justify-between rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900"
                                : "flex items-center justify-between rounded-md border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700"
                            }
                          >
                            <button
                              type="button"
                              className="text-left underline-offset-2 hover:underline"
                              onClick={() =>
                                setSelectedMilestoneId((currentMilestoneId) =>
                                  currentMilestoneId === milestone.id
                                    ? null
                                    : milestone.id,
                                )
                              }
                            >
                              {milestone.name}
                            </button>
                            <Badge variant="secondary">
                              {milestone.percentageContribution}%
                            </Badge>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-slate-500">
                        Complete each milestone to earn full credit.
                      </p>
                    </div>
                  )}
              </div>
              <div>
                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  {status === "loading" ? (
                    <>
                      <Skeleton className="h-48 w-full rounded-none" />
                      <Separator />
                      <div className="space-y-3 p-3">
                        <Skeleton className="h-3 w-36" />
                        <Skeleton className="h-4 w-48" />
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-2 w-4 rounded-full" />
                            <Skeleton className="h-2 w-2 rounded-full" />
                            <Skeleton className="h-2 w-2 rounded-full" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-14" />
                            <Skeleton className="h-8 w-14" />
                          </div>
                        </div>
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </>
                  ) : (
                    <div
                      className={`transition-all duration-300 ease-out ${
                        isLoadedContentVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-1 opacity-0"
                      }`}
                    >
                      {currentTaskAsset && (
                        <>
                          <img
                            alt={
                              status === "success" && task
                                ? `${task.title} preview`
                                : "Task preview"
                            }
                            src={currentTaskAsset.url}
                            className="h-48 w-full object-cover"
                          />
                          <Separator />
                        </>
                      )}
                      <div className="space-y-3 p-3">
                        {selectedMilestone && (
                          <p className="text-xs text-slate-500">
                            Showing assets for {selectedMilestone.name}
                          </p>
                        )}
                        {currentTaskAsset && (
                          <p className="text-sm text-slate-500">
                            {currentTaskAsset.fileName}
                          </p>
                        )}
                        {visibleAssets.length > 1 && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1">
                              {visibleAssets.map((asset, index) => (
                                <button
                                  key={asset.assetId}
                                  type="button"
                                  aria-label={`Show preview ${index + 1}`}
                                  onClick={() => setActiveAssetIndex(index)}
                                  className={
                                    index === activeAssetIndex
                                      ? "h-2 w-4 rounded-full bg-slate-900"
                                      : "h-2 w-2 rounded-full bg-slate-300"
                                  }
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActiveAssetIndex((currentIndex) =>
                                    currentIndex === 0
                                      ? visibleAssets.length - 1
                                      : currentIndex - 1,
                                  )
                                }
                              >
                                Prev
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActiveAssetIndex((currentIndex) =>
                                    currentIndex + 1 >= visibleAssets.length
                                      ? 0
                                      : currentIndex + 1,
                                  )
                                }
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                        {robloxLink && (
                          <Button asChild className="w-full">
                            <a
                              href={robloxLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View on Roblox
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-slate-500">
              {audience === "teacher" ? (
                <p>
                  You’re viewing the teacher preview. Share this assignment with
                  your students directly from Google Classroom. Any updates you
                  make will appear here instantly.
                </p>
              ) : (
                <p>
                  Ready to begin? Use the instructions above to guide your
                  adventure. Your progress will automatically sync with your
                  Google Classroom.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const TaskView = ({ audience }: TaskViewProps) => {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");
  const loginHint = searchParams.get("login_hint") ?? undefined;

  return (
    <CognitoAuthGate loginHint={loginHint}>
      {({ user, signOut }) => (
        <TaskViewAuthorized
          audience={audience}
          taskId={taskId}
          loginHint={loginHint}
          user={user}
          signOut={signOut}
        />
      )}
    </CognitoAuthGate>
  );
};

export default TaskView;
