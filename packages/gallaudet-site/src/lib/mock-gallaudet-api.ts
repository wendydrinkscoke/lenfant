import {
  AttachTaskResponseContent,
  DefaultApi,
  DelegateGoogleClassroomAccessResponseContent,
  GetLinkedRobloxAccountResponseContent,
  GetTaskCatalogResponseContent,
  GetTaskResponseContent,
  LinkRobloxAccountResponseContent,
  Milestone,
  TaskInstanceView,
} from "gallaudet-api-typescript-react-query-hooks";
import { ResponseError } from "gallaudet-api-typescript-react-query-hooks";

const MOCK_LATENCY_MS = 200;

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
    partnerName: "NUSA Aerospace",
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
    partnerName: "Blue Coral Labs",
    robloxGameId: "9812374501",
  },
};

const MOCK_CATALOG: GetTaskCatalogResponseContent = {
  partners: [
    {
      partnerId: "nusa-aero",
      partnerName: "NUSA Aerospace",
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
      partnerId: "blue-coral",
      partnerName: "Blue Coral Labs",
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
  partnerName: "Gallaudet Dev Sandbox",
  robloxGameId: "default-mock-game-id",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockGallaudetApi extends DefaultApi {
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

    const partnerId = request.attachTaskRequestContent.partnerId;
    const entryId = request.attachTaskRequestContent.entryId;

    const entry = MOCK_CATALOG.partners
      .find((partner) => partner.partnerId === partnerId)
      ?.catalogEntries.find((catalogEntry) => catalogEntry.entryId === entryId);

    return {
      message: entry
        ? `Mock attachment created for "${entry.name}".`
        : "Mock attachment created for offline preview.",
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
    return { message: "Mock Classroom access delegated locally." };
  }

  async getLinkedRobloxAccount(
    _request: Parameters<DefaultApi["getLinkedRobloxAccount"]>[0],
  ): Promise<GetLinkedRobloxAccountResponseContent> {
    await delay(MOCK_LATENCY_MS);
    try {
      const shouldReturnLinked =
        typeof window !== "undefined" &&
        localStorage.getItem("mock-roblox-linked") === "true";
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
