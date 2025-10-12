import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { getGallaudetApi } from "../lib/gallaudet-api";
import type { GetTaskResponseContent } from "gallaudet-api-typescript-react-query-hooks";
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks";
import { CognitoAuthGate } from "./cognito-auth-gate";
import type { AuthUser } from "../hooks/use-auth";

type TaskViewProps = {
  audience: "student" | "teacher";
};

type TaskViewAuthorizedProps = {
  audience: TaskViewProps["audience"];
  taskId: string | null;
  user: AuthUser | null;
  signOut: () => Promise<void>;
};

const PREVIEW_IMAGE = "/placeholder.svg";
const PREVIEW_CAPTION = "Classroom task preview coming soon.";

const formatAudienceLabel = (audience: "student" | "teacher") =>
  audience === "teacher" ? "Teacher Preview" : "Student Assignment";

const TaskViewAuthorized = ({
  audience,
  taskId,
  user,
  signOut,
}: TaskViewAuthorizedProps) => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [task, setTask] = useState<GetTaskResponseContent["task"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        <p className="text-slate-600">
          Fetching assignment details from Google Classroom. This usually takes
          just a moment.
        </p>
      );
    }

    if (status === "error") {
      return (
        <p className="text-red-600">
          {errorMessage ??
            "Something went wrong while attempting to display this task."}
        </p>
      );
    }

    if (status === "success" && task) {
      return (
        <p className="text-slate-600 leading-relaxed">{task.instructions}</p>
      );
    }

    return (
      <p className="text-slate-600">
        Provide a task identifier in the URL to see assignment details.
      </p>
    );
  }, [status, task, errorMessage]);

  const partnerDisplay = useMemo(() => {
    if (status === "success" && task) {
      return task.partnerName;
    }
    if (status === "loading") {
      return "Loading partner…";
    }
    return "Unknown partner";
  }, [status, task]);

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

        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="uppercase tracking-wide">
                {formatAudienceLabel(audience)}
              </Badge>
              <CardTitle className="mt-3 text-3xl font-semibold text-slate-900">
                {headerTitle}
              </CardTitle>
              <p className="mt-2 text-base text-slate-600">
                {headerSubheading}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-slate-500 md:items-end">
              <span>
                <strong>Partner:</strong> {partnerDisplay}
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
              </div>
              <div>
                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <img
                    alt={status === "success" && task ? task.title : "Task preview"}
                    src={PREVIEW_IMAGE}
                    className="h-48 w-full object-cover"
                  />
                  <Separator />
                  <p className="p-3 text-sm text-slate-500">
                    {PREVIEW_CAPTION}
                  </p>
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
          user={user}
          signOut={signOut}
        />
      )}
    </CognitoAuthGate>
  );
};

export default TaskView;
