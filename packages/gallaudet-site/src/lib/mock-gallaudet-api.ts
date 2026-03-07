import {
  AbortAssetUploadRequest,
  AbortAssetUploadResponseContent,
  AssetRecord,
  AttachTaskResponseContent,
  CompleteAssetUploadRequest,
  CompleteAssetUploadResponseContent,
  CreateProjectResponseContent,
  DelegateRobloxSecretStoreAccessRequest,
  DelegateRobloxSecretStoreAccessResponseContent,
  DefaultApi,
  DelegateGoogleClassroomAccessResponseContent,
  GetAssetUploadPartUrlRequest,
  GetAssetUploadPartUrlResponseContent,
  GetGoogleClassroomAccessStatusResponseContent,
  GetLinkedRobloxAccountResponseContent,
  GetRobloxSecretStoreAccessStatusRequest,
  GetRobloxSecretStoreAccessStatusResponseContent,
  GetSimulatedTaskResponseContent,
  GetTaskCatalogForProjectResponseContent,
  GetTaskCatalogResponseContent,
  GetTaskResponseContent,
  ListAssetsRequest,
  ListAssetsResponseContent,
  ListProjectsResponseContent,
  LinkRobloxAccountResponseContent,
  Milestone,
  StartAssetUploadRequest,
  StartAssetUploadResponseContent,
  TaskInstanceView,
  TaskViewAsset,
  VendSecretRequest,
  VendSecretResponseContent,
} from "gallaudet-api-typescript-react-query-hooks";
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks";

const MOCK_LATENCY_MS = 1800;
const MOCK_ASSET_MULTIPART_THRESHOLD_BYTES = 10_000_000;
const MOCK_ASSET_MULTIPART_PART_SIZE_BYTES = 8_000_000;
const MOCK_ASSET_UPLOAD_URL_TTL_SECONDS = 900;
const MOCK_COGNITO_USER_NAMESPACE = "mock-cognito-user";
const MOCK_LOCAL_STORAGE_KEYS = {
  projects: "mock-gallaudet-project-ids",
  robloxLinked: "mock-roblox-linked",
  googleClassroomDelegated: "mock-google-classroom-delegated",
  robloxSecretStoreDelegations: "mock-roblox-secret-store-delegations",
} as const;

type MockUploadSession = {
  uploadSessionId: string;
  assetId: string;
  experienceId: string;
  fileName: string;
  contentType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  sizeBytes: number;
  objectKey: string;
  strategy: "single-part-put" | "multipart-put";
  multipartPartCount?: number;
  multipartPartSizeBytes?: number;
  createdAt: number;
};

const mockUploadSessions = new Map<string, MockUploadSession>();
const mockAssets = new Map<string, AssetRecord>();

const DEFAULT_MOCK_PROJECT_IDS = ["12039485732", "9876543210"];
const DEFAULT_ROBLOX_SECRET_STORE_DELEGATIONS: Record<string, boolean> = {
  "12039485732": true,
  "9876543210": false,
};
const DEFAULT_MOCK_ROBLOX_LINKED = true;
const DEFAULT_MOCK_GOOGLE_CLASSROOM_DELEGATED = true;

const MOCK_MILESTONES: Milestone[] = [
  { id: "rose-garden", name: "Spend 30 Seconds in the Rose Garden", percentageContribution: 40 },
  { id: "green-room", name: "Visit the Green Room", percentageContribution: 15 },
  { id: "resolute-desk", name: "Sit at the Resolute Desk", percentageContribution: 45 },
];

const MOCK_TASK_PREVIEW_ASSETS: TaskViewAsset[] = [
  {
    assetId: "mock-task-cover",
    fileName: "run-the-world-learn-country-names-thumbnail.png",
    contentType: "image/png",
    url: "/run-the-world-learn-country-names-thumbnail.png",
  },
  {
    assetId: "mock-task-gameplay",
    fileName: "run-the-world-gameplay.gif",
    contentType: "image/gif",
    url: "/run-the-world-gameplay.gif",
  },
];

const MOCK_MILESTONE_PREVIEW_ASSETS: TaskViewAsset[] = [
  {
    assetId: "mock-milestone-briefing",
    fileName: "teacher-assisting-student-placeholder.png",
    contentType: "image/png",
    url: "/teacher-assisting-student-placeholder.png",
  },
  {
    assetId: "mock-milestone-prototype",
    fileName: "gwb-lib-gameplay.gif",
    contentType: "image/gif",
    url: "/gwb-lib-gameplay.gif",
  },
  {
    assetId: "mock-milestone-demo",
    fileName: "google-classroom-integration-demo.gif",
    contentType: "image/gif",
    url: "/google-classroom-integration-demo.gif",
  },
];

const withMockTaskAssets = (task: TaskInstanceView): TaskInstanceView => {
  const milestonesWithAssets = (task.milestones ?? []).map((milestone, index) => ({
    ...milestone,
    assetIds: [
      MOCK_MILESTONE_PREVIEW_ASSETS[index % MOCK_MILESTONE_PREVIEW_ASSETS.length]
        .assetId,
    ],
  }));

  return {
    ...task,
    assetIds: MOCK_TASK_PREVIEW_ASSETS.map((asset) => asset.assetId),
    assets: [
      ...MOCK_TASK_PREVIEW_ASSETS,
      ...MOCK_MILESTONE_PREVIEW_ASSETS,
    ],
    milestones: milestonesWithAssets,
  };
};

const MOCK_TASKS: Record<string, TaskInstanceView> = {
  "task-astro-001": {
    title: "Lunar Logistics Challenge",
    subheading: "Balance fuel, cargo, and time to reach the outpost.",
    instructions:
      "You are the mission specialist for a supply drop to the Mare Tranquillitatis outpost. Adjust cargo weight, choose a launch window, and manage thruster fuel to keep the crew safe. Submit your flight plan and one risk you mitigated.",
    milestones: MOCK_MILESTONES,
    experienceName: "NUSA Aerospace",
    robloxGameId: "12039485732",
  },
  "task-eco-014": {
    title: "Coastal Clean-Up Sprint",
    subheading: "Coordinate bots to clear debris without harming wildlife.",
    instructions:
      "A storm scattered debris along the shoreline. Program your clean-up bots to prioritize biodegradable waste while steering clear of nesting sites. Upload a screenshot of your bot route and a short note on why you prioritized that path.",
    milestones: [
      { id: "plan", name: "Route planned", percentageContribution: 20 },
      { id: "deploy", name: "Bots deployed", percentageContribution: 40 },
      { id: "report", name: "Impact report", percentageContribution: 40 },
    ],
    experienceName: "Blue Coral Labs",
    robloxGameId: "9812374501",
  },
};

const MOCK_CATALOG: GetTaskCatalogResponseContent = {
  experiences: [
    {
      experienceId: "12039485732",
      experienceName: "NUSA Aerospace",
      catalogEntries: [
        {
          entryId: "task-astro-001",
          name: "Lunar Logistics Challenge",
          subheading: "Balance fuel, cargo, and time to reach the outpost.",
          instructions:
            "Coordinate your crew, fuel calculations, and launch timing to deliver supplies safely. Present a short mission plan before launch.",
          milestones: MOCK_MILESTONES,
        },
        {
          entryId: "task-astro-002",
          name: "Orbital Repair Run",
          subheading: "Triangulate the repair drone to fix a damaged satellite.",
          instructions:
            "Plot a low-fuel transfer orbit, avoid debris, and capture the drifting panel. Share your fuel usage and one efficiency improvement.",
          milestones: [
            { id: "scan", name: "Damage scan complete", percentageContribution: 25 },
            { id: "plot", name: "Trajectory plotted", percentageContribution: 35 },
            { id: "repair", name: "Repair executed", percentageContribution: 40 },
          ],
        },
      ],
    },
    {
      experienceId: "9876543210",
      experienceName: "Blue Coral Labs",
      catalogEntries: [
        {
          entryId: "task-eco-014",
          name: "Coastal Clean-Up Sprint",
          subheading: "Coordinate bots to clear debris without harming wildlife.",
          instructions:
            "Tune the bot behavior to prioritize biodegradables and protect nesting grounds. Deliver a before/after snapshot set.",
          milestones: [
            { id: "survey", name: "Coast surveyed", percentageContribution: 20 },
            { id: "optimize", name: "Route optimized", percentageContribution: 40 },
            { id: "cleanup", name: "Cleanup executed", percentageContribution: 40 },
          ],
        },
      ],
    },
  ],
};

const MOCK_FALLBACK_TASK: TaskInstanceView = {
  title: "Classroom sandbox task",
  subheading: "Take a tour in the home of the nation's First Family!",
  instructions:
    "Run around the White House exploring the various special rooms and areas to earn points.",
  milestones: MOCK_MILESTONES,
  experienceName: "Be Politician - Learn DC Politics",
  robloxGameId: "1213026131",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isBrowserEnvironment = () => typeof window !== "undefined";

const getLocalStorageItem = (key: string): string | null => {
  if (!isBrowserEnvironment()) {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalStorageItem = (key: string, value: string): void => {
  if (!isBrowserEnvironment()) {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage issues and continue with in-memory defaults.
  }
};

const readJsonFromStorage = <T>(key: string, fallback: T): T => {
  const raw = getLocalStorageItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const seedMockDefaults = () => {
  if (!isBrowserEnvironment()) {
    return;
  }

  if (!getLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.projects)) {
    setLocalStorageItem(
      MOCK_LOCAL_STORAGE_KEYS.projects,
      JSON.stringify(DEFAULT_MOCK_PROJECT_IDS),
    );
  }
  if (!getLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.robloxSecretStoreDelegations)) {
    setLocalStorageItem(
      MOCK_LOCAL_STORAGE_KEYS.robloxSecretStoreDelegations,
      JSON.stringify(DEFAULT_ROBLOX_SECRET_STORE_DELEGATIONS),
    );
  }
  if (!getLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.robloxLinked)) {
    setLocalStorageItem(
      MOCK_LOCAL_STORAGE_KEYS.robloxLinked,
      String(DEFAULT_MOCK_ROBLOX_LINKED),
    );
  }
  if (!getLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.googleClassroomDelegated)) {
    setLocalStorageItem(
      MOCK_LOCAL_STORAGE_KEYS.googleClassroomDelegated,
      String(DEFAULT_MOCK_GOOGLE_CLASSROOM_DELEGATED),
    );
  }
};

const getMockProjectIds = (): string[] => {
  const projects = readJsonFromStorage<string[]>(
    MOCK_LOCAL_STORAGE_KEYS.projects,
    DEFAULT_MOCK_PROJECT_IDS,
  );
  return projects
    .map((experienceId) => experienceId.trim())
    .filter((experienceId) => experienceId.length > 0);
};

const setMockProjectIds = (projectIds: string[]) => {
  setLocalStorageItem(
    MOCK_LOCAL_STORAGE_KEYS.projects,
    JSON.stringify(projectIds),
  );
};

const getRobloxSecretStoreDelegations = (): Record<string, boolean> =>
  readJsonFromStorage<Record<string, boolean>>(
    MOCK_LOCAL_STORAGE_KEYS.robloxSecretStoreDelegations,
    DEFAULT_ROBLOX_SECRET_STORE_DELEGATIONS,
  );

const setRobloxSecretStoreDelegations = (delegations: Record<string, boolean>) => {
  setLocalStorageItem(
    MOCK_LOCAL_STORAGE_KEYS.robloxSecretStoreDelegations,
    JSON.stringify(delegations),
  );
};

const upsertMockProject = (experienceId: string) => {
  const existing = getMockProjectIds();
  if (existing.includes(experienceId)) {
    return;
  }
  setMockProjectIds([...existing, experienceId]);
};

const createMockSecretId = () =>
  `mock-${Math.random().toString(36).slice(2, 10)}`;

const createMockId = () =>
  `mock-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const currentUnixSeconds = () => Math.floor(Date.now() / 1000);

const mockOperationError = (
  status: number,
  message: string,
  operationName: string,
): ResponseError =>
  new ResponseError(
    new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
    operationName,
  );

export class MockGallaudetApi extends DefaultApi {
  constructor() {
    super();
    seedMockDefaults();
  }

  async getTask(
    request: Parameters<DefaultApi["getTask"]>[0],
  ): Promise<GetTaskResponseContent> {
    await delay(MOCK_LATENCY_MS);
    const task = withMockTaskAssets(MOCK_TASKS[request.taskId] ?? {
      ...MOCK_FALLBACK_TASK,
      title: "Tour the White House",
    });
    return { task };
  }

  async getSimulatedTask(
    request: Parameters<DefaultApi["getSimulatedTask"]>[0],
  ): Promise<GetSimulatedTaskResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experience = MOCK_CATALOG.experiences.find(
      (catalogExperience) => catalogExperience.experienceId === request.experienceId,
    );
    const entry = experience?.catalogEntries.find(
      (catalogEntry) => catalogEntry.entryId === request.entryId,
    );

    if (!experience || !entry) {
      throw mockOperationError(
        404,
        "Task catalog entry not found",
        "getSimulatedTask",
      );
    }

    const task = withMockTaskAssets({
      title: entry.name,
      subheading: entry.subheading,
      instructions: entry.instructions,
      milestones: entry.milestones,
      assetIds: entry.assetIds,
      experienceName: experience.experienceName,
      robloxGameId: request.experienceId,
      experienceAssetIds: experience.assetIds,
    });

    return { task };
  }

  async getTaskCatalog(): Promise<GetTaskCatalogResponseContent> {
    await delay(MOCK_LATENCY_MS);
    return MOCK_CATALOG;
  }

  async getTaskCatalogForProject(
    request: Parameters<DefaultApi["getTaskCatalogForProject"]>[0],
  ): Promise<GetTaskCatalogForProjectResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId = request.experienceId.trim();
    const matchingExperience = MOCK_CATALOG.experiences.find(
      (experience) => experience.experienceId === experienceId,
    );

    if (matchingExperience) {
      return {
        experience: matchingExperience,
      };
    }

    return {
      experience: {
        experienceId,
        experienceName: `Universe ${experienceId}`,
        catalogEntries: [],
      },
    };
  }

  async attachTask(
    request: Parameters<DefaultApi["attachTask"]>[0],
  ): Promise<AttachTaskResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId = request.attachTaskRequestContent.experienceId;
    const entryId = request.attachTaskRequestContent.entryId;

    const entry = MOCK_CATALOG.experiences
      .find((experience) => experience.experienceId === experienceId)
      ?.catalogEntries.find((catalogEntry) => catalogEntry.entryId === entryId);

    return {
      message: entry
        ? `Mock attachment created for "${entry.name}".`
        : "Mock attachment created for offline preview.",
    };
  }

  async createProject(
    request: Parameters<DefaultApi["createProject"]>[0],
  ): Promise<CreateProjectResponseContent> {
    await delay(MOCK_LATENCY_MS);
    const experienceId = request.experienceId.trim();
    upsertMockProject(experienceId);

    const delegations = getRobloxSecretStoreDelegations();
    if (delegations[experienceId] === undefined) {
      delegations[experienceId] = false;
      setRobloxSecretStoreDelegations(delegations);
    }

    return { message: `Mock project created for universe ${request.experienceId}.` };
  }

  async startAssetUpload(
    request: StartAssetUploadRequest,
  ): Promise<StartAssetUploadResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId = request.experienceId?.trim();
    const fileName = request.startAssetUploadRequestContent.fileName?.trim();
    const contentType = request.startAssetUploadRequestContent.contentType;
    const contentLengthBytes = request.startAssetUploadRequestContent.contentLengthBytes;

    if (!experienceId) {
      throw mockOperationError(
        400,
        "experienceId is required",
        "startAssetUpload",
      );
    }
    if (!fileName) {
      throw mockOperationError(
        400,
        "fileName is required",
        "startAssetUpload",
      );
    }
    if (!(contentLengthBytes > 0)) {
      throw mockOperationError(
        400,
        "contentLengthBytes must be a positive number",
        "startAssetUpload",
      );
    }

    const strategy =
      contentLengthBytes > MOCK_ASSET_MULTIPART_THRESHOLD_BYTES
        ? "multipart-put"
        : "single-part-put";
    const assetId = createMockId();
    const uploadSessionId = createMockId();
    const createdAt = currentUnixSeconds();
    const objectKey = `${MOCK_COGNITO_USER_NAMESPACE}/${experienceId}/${assetId}/${fileName.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const partCount =
      strategy === "multipart-put"
        ? Math.ceil(contentLengthBytes / MOCK_ASSET_MULTIPART_PART_SIZE_BYTES)
        : undefined;

    mockUploadSessions.set(uploadSessionId, {
      uploadSessionId,
      assetId,
      experienceId,
      fileName,
      contentType,
      sizeBytes: contentLengthBytes,
      objectKey,
      strategy,
      multipartPartCount: partCount,
      multipartPartSizeBytes:
        strategy === "multipart-put" ? MOCK_ASSET_MULTIPART_PART_SIZE_BYTES : undefined,
      createdAt,
    });

    return {
      assetId,
      uploadSessionId,
      strategy,
      expiresAt: createdAt + MOCK_ASSET_UPLOAD_URL_TTL_SECONDS,
      uploadUrl:
        strategy === "single-part-put"
          ? `mock://asset-upload/${uploadSessionId}/single`
          : undefined,
      multipartPartCount: partCount,
      multipartPartSizeBytes:
        strategy === "multipart-put" ? MOCK_ASSET_MULTIPART_PART_SIZE_BYTES : undefined,
    };
  }

  async getAssetUploadPartUrl(
    request: GetAssetUploadPartUrlRequest,
  ): Promise<GetAssetUploadPartUrlResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const session = mockUploadSessions.get(request.uploadSessionId);
    if (!session || session.experienceId !== request.experienceId) {
      throw mockOperationError(
        404,
        "Upload session not found.",
        "getAssetUploadPartUrl",
      );
    }
    if (session.strategy !== "multipart-put") {
      throw mockOperationError(
        400,
        "This upload session does not use multipart uploads.",
        "getAssetUploadPartUrl",
      );
    }
    if (
      !Number.isInteger(request.partNumber) ||
      request.partNumber < 1 ||
      request.partNumber > (session.multipartPartCount ?? 0)
    ) {
      throw mockOperationError(
        400,
        "partNumber exceeds multipart part count.",
        "getAssetUploadPartUrl",
      );
    }

    return {
      uploadUrl: `mock://asset-upload/${request.uploadSessionId}/part/${request.partNumber}`,
      expiresAt: currentUnixSeconds() + MOCK_ASSET_UPLOAD_URL_TTL_SECONDS,
    };
  }

  async completeAssetUpload(
    request: CompleteAssetUploadRequest,
  ): Promise<CompleteAssetUploadResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const session = mockUploadSessions.get(request.uploadSessionId);
    if (!session || session.experienceId !== request.experienceId) {
      throw mockOperationError(
        404,
        "Upload session not found.",
        "completeAssetUpload",
      );
    }

    const completion = request.completeAssetUploadRequestContent.completion;
    const hasSinglePart = "singlePart" in completion;
    const hasMultipart = "multipart" in completion;
    if (hasSinglePart === hasMultipart) {
      throw mockOperationError(
        400,
        "completion must include exactly one of singlePart or multipart",
        "completeAssetUpload",
      );
    }

    const now = currentUnixSeconds();
    const asset: AssetRecord = {
      assetId: session.assetId,
      experienceId: session.experienceId,
      fileName: session.fileName,
      contentType: session.contentType,
      sizeBytes: session.sizeBytes,
      objectKey: session.objectKey,
      status: "ready",
      createdAt: session.createdAt,
      updatedAt: now,
    };
    mockAssets.set(asset.assetId, asset);
    mockUploadSessions.delete(request.uploadSessionId);

    return { asset };
  }

  async abortAssetUpload(
    request: AbortAssetUploadRequest,
  ): Promise<AbortAssetUploadResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const session = mockUploadSessions.get(request.uploadSessionId);
    if (!session || session.experienceId !== request.experienceId) {
      return { message: "Upload session already cleared." };
    }

    mockUploadSessions.delete(request.uploadSessionId);
    return { message: "Upload session aborted." };
  }

  async listAssets(
    request: ListAssetsRequest,
  ): Promise<ListAssetsResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId = request.experienceId?.trim();
    if (!experienceId) {
      throw mockOperationError(
        400,
        "experienceId is required",
        "listAssets",
      );
    }

    const assets = [...mockAssets.values()]
      .filter((asset) => asset.experienceId === experienceId)
      .sort((left, right) => {
        if (right.updatedAt !== left.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }
        if (right.createdAt !== left.createdAt) {
          return right.createdAt - left.createdAt;
        }
        return left.assetId.localeCompare(right.assetId);
      });

    return { assets };
  }

  async listProjects(): Promise<ListProjectsResponseContent> {
    await delay(MOCK_LATENCY_MS);
    const projectIds = getMockProjectIds();
    return {
      projects: projectIds.map((experienceId) => ({ experienceId })),
    };
  }

  async linkRobloxAccount(
    _request: Parameters<DefaultApi["linkRobloxAccount"]>[0],
  ): Promise<LinkRobloxAccountResponseContent> {
    await delay(MOCK_LATENCY_MS);
    return { message: "Mock Roblox account linked locally." };
  }

  async delegateGoogleClassroomAccess(
    _request: Parameters<DefaultApi["delegateGoogleClassroomAccess"]>[0],
  ): Promise<DelegateGoogleClassroomAccessResponseContent> {
    await delay(MOCK_LATENCY_MS);
    setLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.googleClassroomDelegated, "true");
    return { message: "Mock Classroom access delegated locally." };
  }

  async getGoogleClassroomAccessStatus(): Promise<GetGoogleClassroomAccessStatusResponseContent> {
    await delay(MOCK_LATENCY_MS);
    const delegated =
      getLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.googleClassroomDelegated) === "true";
    return { delegated };
  }

  async delegateRobloxSecretStoreAccess(
    request: DelegateRobloxSecretStoreAccessRequest,
  ): Promise<DelegateRobloxSecretStoreAccessResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId =
      request.delegateRobloxSecretStoreAccessRequestContent.experienceId?.trim();
    const apiKey =
      request.delegateRobloxSecretStoreAccessRequestContent.apiKey?.trim();
    if (!experienceId || !apiKey) {
      throw new ResponseError(
        new Response(
          JSON.stringify({ message: "apiKey and experienceId are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
        "delegateRobloxSecretStoreAccess",
      );
    }

    upsertMockProject(experienceId);
    const delegations = getRobloxSecretStoreDelegations();
    delegations[experienceId] = true;
    setRobloxSecretStoreDelegations(delegations);

    return { message: "Mock Roblox Secret Store access delegated locally." };
  }

  async getRobloxSecretStoreAccessStatus(
    request: GetRobloxSecretStoreAccessStatusRequest,
  ): Promise<GetRobloxSecretStoreAccessStatusResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId = request.experienceId?.trim();
    if (!experienceId) {
      throw new ResponseError(
        new Response(JSON.stringify({ message: "experienceId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
        "getRobloxSecretStoreAccessStatus",
      );
    }

    const delegations = getRobloxSecretStoreDelegations();
    return {
      delegated: Boolean(delegations[experienceId]),
    };
  }

  async vendSecret(
    request: VendSecretRequest,
  ): Promise<VendSecretResponseContent> {
    await delay(MOCK_LATENCY_MS);

    const experienceId = request.experienceId?.trim();
    if (!experienceId) {
      throw new ResponseError(
        new Response(JSON.stringify({ message: "experienceId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
        "vendSecret",
      );
    }

    const delegations = getRobloxSecretStoreDelegations();
    if (!delegations[experienceId]) {
      throw new ResponseError(
        new Response(
          JSON.stringify({
            message:
              "Roblox secret store access has not been delegated for this experience.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
        "vendSecret",
      );
    }

    return {
      secretId: createMockSecretId(),
    };
  }

  async getLinkedRobloxAccount(
    _request: Parameters<DefaultApi["getLinkedRobloxAccount"]>[0],
  ): Promise<GetLinkedRobloxAccountResponseContent> {
    await delay(MOCK_LATENCY_MS);
    try {
      const shouldReturnLinked =
        getLocalStorageItem(MOCK_LOCAL_STORAGE_KEYS.robloxLinked) === "true";
      if (shouldReturnLinked) {
        return {
          robloxUserId: "FAKE_ROBLOX_USER_ID",
        };
      }
    } catch {
      // Ignore localStorage issues and fall back to the unlinked mock.
    }

    throw new ResponseError(
      new Response(JSON.stringify({ message: "Roblox account not linked" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      "getLinkedRobloxAccount",
    );
  }
}
