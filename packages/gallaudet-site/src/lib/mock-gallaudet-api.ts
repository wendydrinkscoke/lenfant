import {
  AttachTaskResponseContent,
  CreateProjectResponseContent,
  DelegateRobloxSecretStoreAccessRequest,
  DelegateRobloxSecretStoreAccessResponseContent,
  DefaultApi,
  DelegateGoogleClassroomAccessResponseContent,
  GetGoogleClassroomAccessStatusResponseContent,
  GetLinkedRobloxAccountResponseContent,
  GetRobloxSecretStoreAccessStatusRequest,
  GetRobloxSecretStoreAccessStatusResponseContent,
  GetTaskCatalogResponseContent,
  GetTaskResponseContent,
  ListProjectsResponseContent,
  LinkRobloxAccountResponseContent,
  Milestone,
  TaskInstanceView,
  VendSecretRequest,
  VendSecretResponseContent,
} from "gallaudet-api-typescript-react-query-hooks";
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks";

const MOCK_LATENCY_MS = 200;
const MOCK_LOCAL_STORAGE_KEYS = {
  projects: "mock-gallaudet-project-ids",
  robloxLinked: "mock-roblox-linked",
  googleClassroomDelegated: "mock-google-classroom-delegated",
  robloxSecretStoreDelegations: "mock-roblox-secret-store-delegations",
} as const;

const DEFAULT_MOCK_PROJECT_IDS = ["12039485732", "9876543210"];
const DEFAULT_ROBLOX_SECRET_STORE_DELEGATIONS: Record<string, boolean> = {
  "12039485732": true,
  "9876543210": false,
};
const DEFAULT_MOCK_ROBLOX_LINKED = true;
const DEFAULT_MOCK_GOOGLE_CLASSROOM_DELEGATED = true;

const MOCK_MILESTONES: Milestone[] = [
  { id: "briefing", name: "Mission briefing", percentageContribution: 15 },
  { id: "prototype", name: "Build your prototype", percentageContribution: 45 },
  { id: "demo", name: "Classroom demo", percentageContribution: 40 },
];

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
      experienceId: "nusa-aero",
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
      experienceId: "blue-coral",
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
  subheading: "Offline preview mode with mock data.",
  instructions:
    "This mock assignment is served locally so you can build UI without backend calls. Add a ?taskId= parameter to the URL to see per-task titles.",
  milestones: MOCK_MILESTONES,
  experienceName: "Gallaudet Dev Sandbox",
  robloxGameId: "default-mock-game-id",
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

export class MockGallaudetApi extends DefaultApi {
  constructor() {
    super();
    seedMockDefaults();
  }

  async getTask(
    request: Parameters<DefaultApi["getTask"]>[0],
  ): Promise<GetTaskResponseContent> {
    await delay(MOCK_LATENCY_MS);
    const task = MOCK_TASKS[request.taskId] ?? {
      ...MOCK_FALLBACK_TASK,
      title: `Sandbox mission (${request.taskId})`,
    };
    return { task };
  }

  async getTaskCatalog(): Promise<GetTaskCatalogResponseContent> {
    await delay(MOCK_LATENCY_MS);
    return MOCK_CATALOG;
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
