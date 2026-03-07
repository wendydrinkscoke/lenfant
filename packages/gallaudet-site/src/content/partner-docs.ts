export type PartnerApiAuthMode = {
  kind: "api-key" | "cognito"
  label: string
  details: string
}

export type PartnerApiExample = {
  title: string
  code: string
}

export type PartnerApiResource = {
  id: string
  category: "runtime" | "onboarding"
  title: string
  method: "GET" | "POST" | "PUT"
  path: string
  summary: string
  whyUseful: string
  auth: PartnerApiAuthMode
  requestFields: string[]
  responseFields: string[]
  commonErrors: string[]
  examples: PartnerApiExample[]
}

export type PartnerDocsArticle = {
  slug: string
  kind: "guide" | "explainer"
  title: string
  summary: string
  audience: string
  estimatedRead: string
  updatedOn: string
  sections: Array<{
    heading: string
    body: string[]
  }>
  relatedApiIds: string[]
}

export type PartnerClientDownload = {
  id: string
  title: string
  summary: string
  href: string
  format: string
  updatedOn: string
  audience: string
}

const LUA_PUT_EXPERIENCE_VANILLA_SNIPPET = [
  "local result, err = service:PutExperience({",
  "  robloxGameId = \"9228429469\",",
  "})",
  "",
  "if err then",
  "  warn(\"PutExperience failed:\", err.message)",
  "  return nil, err",
  "end",
  "",
  "return result, nil",
].join("\n")

const LUA_PUT_EXPERIENCE_KNIT_SNIPPET = [
  "function CivicTechForSchoolsService:SyncExperienceProfile()",
  "  local result, err = self:PutExperience(self.ExperienceProfile)",
  "  if err then",
  "    warn(\"PutExperience failed:\", err.message)",
  "    return nil, err",
  "  end",
  "",
  "  return result, nil",
  "end",
].join("\n")

const LUA_CATALOG_TASK_VANILLA_SNIPPET = [
  "local entryId = \"get-100-points\"",
  "local payload = {",
  "  name = \"Get 100 Points\",",
  "  subheading = \"Obtain at least 100 points in one session\",",
  "  instructions = \"Get points by selecting the correct country quickly.\",",
  "  milestones = {",
  "    { id = \"reach-50-points\", name = \"Reach 50 points\", percentageContribution = 50 },",
  "    { id = \"reach-100-points\", name = \"Reach 100 points\", percentageContribution = 50 },",
  "  },",
  "}",
  "",
  "local result, err = service:CatalogTask(entryId, payload)",
  "if err then",
  "  warn(\"CatalogTask failed:\", err.message)",
  "  return nil, err",
  "end",
  "",
  "return result, nil",
].join("\n")

const LUA_CATALOG_TASK_KNIT_SNIPPET = [
  "function CivicTechForSchoolsService:UpsertCatalogTask(entryId, payload)",
  "  local result, err = self:CatalogTask(entryId, payload)",
  "  if err then",
  "    warn(\"CatalogTask failed:\", err.message)",
  "    return nil, err",
  "  end",
  "",
  "  return result, nil",
  "end",
].join("\n")

const LUA_LIST_TASKS_VANILLA_SNIPPET = [
  "function TaskRuntime:PushTasksToPlayer(player)",
  "  local tasks, err = self.CtsService:ListTasksForPlayer(tostring(player.UserId))",
  "  if err then",
  "    self.Remotes.TaskAssignmentsUpdated:FireClient(player, { success = false, error = err })",
  "    return nil, err",
  "  end",
  "",
  "  self.Remotes.TaskAssignmentsUpdated:FireClient(player, {",
  "    success = true,",
  "    payload = tasks,",
  "  })",
  "",
  "  return tasks, nil",
  "end",
].join("\n")

const LUA_LIST_TASKS_KNIT_SNIPPET = [
  "function CivicTechForSchoolsService:PushTasksToPlayer(player)",
  "  local tasks, err = self:ListTasksForPlayer(player)",
  "  if err then",
  "    self.Client.TaskAssignmentsUpdated:Fire(player, { success = false, error = err })",
  "    return nil, err",
  "  end",
  "",
  "  self.Client.TaskAssignmentsUpdated:Fire(player, {",
  "    success = true,",
  "    payload = tasks,",
  "  })",
  "",
  "  return tasks, nil",
  "end",
].join("\n")

const LUA_GRADE_TASK_VANILLA_SNIPPET = [
  "function TaskRuntime:GradePlayerTask(player, taskId, percentage)",
  "  local result, err = self.CtsService:GradeTask(",
  "    tostring(player.UserId),",
  "    taskId,",
  "    { percentage = percentage }",
  "  )",
  "",
  "  if err then",
  "    warn(\"GradeTask failed:\", err.message)",
  "    return nil, err",
  "  end",
  "",
  "  self:PushTasksToPlayer(player)",
  "  return result, nil",
  "end",
].join("\n")

const LUA_GRADE_TASK_KNIT_SNIPPET = [
  "function CivicTechForSchoolsService:GradePlayerTask(player, taskId, percentage)",
  "  local result, err = self:GradeTask(player, taskId, { percentage = percentage })",
  "  if err then",
  "    self.Client.TaskAssignmentsUpdated:Fire(player, { success = false, error = err })",
  "    return nil, err",
  "  end",
  "",
  "  self:PushTasksToPlayer(player)",
  "  return result, nil",
  "end",
].join("\n")

const LUA_COMPLETE_MILESTONE_VANILLA_SNIPPET = [
  "function TaskRuntime:CompletePlayerMilestone(player, taskId, milestoneId)",
  "  local result, err = self.CtsService:CompleteMilestone(",
  "    tostring(player.UserId),",
  "    taskId,",
  "    milestoneId",
  "  )",
  "",
  "  if err then",
  "    warn(\"CompleteMilestone failed:\", err.message)",
  "    return nil, err",
  "  end",
  "",
  "  self:PushTasksToPlayer(player)",
  "  return result, nil",
  "end",
].join("\n")

const LUA_COMPLETE_MILESTONE_KNIT_SNIPPET = [
  "function CivicTechForSchoolsService:CompletePlayerMilestone(player, taskId, milestoneId)",
  "  local result, err = self:CompleteMilestone(player, taskId, milestoneId)",
  "  if err then",
  "    self.Client.TaskAssignmentsUpdated:Fire(player, { success = false, error = err })",
  "    return nil, err",
  "  end",
  "",
  "  self:PushTasksToPlayer(player)",
  "  return result, nil",
  "end",
].join("\n")

export const experienceApiResources: PartnerApiResource[] = [
  {
    id: "put-experience",
    category: "runtime",
    title: "Register or update your experience profile",
    method: "PUT",
    path: "/experiences/me",
    summary: "Upserts metadata about your Roblox experience for the API key that is calling.",
    whyUseful: "This gives teachers and internal systems a stable mapping between your API key and your experience metadata.",
    auth: {
      kind: "api-key",
      label: "Partner API key",
      details: "Send your experience key in the x-api-key header from your Roblox server.",
    },
    requestFields: [
      "robloxGameId (string, required): Numeric Roblox place/game identifier.",
    ],
    responseFields: [
      "message (string): Confirmation text such as 'Partner profile saved'.",
    ],
    commonErrors: [
      "403 NotAuthorized: missing or invalid API key.",
      "400 BadRequest: malformed robloxGameId.",
      "500 InternalFailure: backend persistence failure.",
    ],
    examples: [
      {
        title: "Vanilla (RemoteEvent/RemoteFunction style)",
        code: LUA_PUT_EXPERIENCE_VANILLA_SNIPPET,
      },
      {
        title: "Knit service style",
        code: LUA_PUT_EXPERIENCE_KNIT_SNIPPET,
      },
    ],
  },
  {
    id: "catalog-task",
    category: "runtime",
    title: "Create or update a teacher-assignable task",
    method: "PUT",
    path: "/task-catalog/{entryId}",
    summary: "Defines task metadata that teachers can assign from CivicTech for Schools.",
    whyUseful: "This is how your game exposes assignment templates without hardcoding them into the website.",
    auth: {
      kind: "api-key",
      label: "Partner API key",
      details: "Send x-api-key from server-side code. The catalog is scoped to that experience key.",
    },
    requestFields: [
      "entryId (path, required): stable lowercase slug for task template.",
      "name (required): short classroom-facing title.",
      "subheading (required): brief learning objective summary.",
      "instructions (required): student-facing instructions.",
      "milestones (optional): percentage-weighted milestones that sum to 100.",
    ],
    responseFields: [
      "message (string): confirmation that catalog entry was saved.",
    ],
    commonErrors: [
      "400 BadRequest: duplicate milestone IDs or percentages not totaling 100.",
      "403 NotAuthorized: missing or invalid API key.",
      "500 InternalFailure: failed DynamoDB write.",
    ],
    examples: [
      {
        title: "Vanilla (RemoteEvent/RemoteFunction style)",
        code: LUA_CATALOG_TASK_VANILLA_SNIPPET,
      },
      {
        title: "Knit service style",
        code: LUA_CATALOG_TASK_KNIT_SNIPPET,
      },
    ],
  },
  {
    id: "list-tasks-for-player",
    category: "runtime",
    title: "Fetch assignments for a player",
    method: "GET",
    path: "/experiences/me/players/{robloxUserId}/tasks",
    summary: "Returns task instances assigned to a specific player for your experience.",
    whyUseful: "Use this when a player joins or opens your task UI so your game stays synced with teacher assignments.",
    auth: {
      kind: "api-key",
      label: "Partner API key",
      details: "Calls are isolated by the API key's experience identity so games cannot see each other's assignments.",
    },
    requestFields: [
      "robloxUserId (path, required): Roblox UserId for the current player.",
    ],
    responseFields: [
      "tasks (array): list of PlayerTaskAssignment records.",
      "taskId: UUID-like assignment identifier used by grading endpoints.",
      "entryId: your catalog entry ID.",
      "name/subheading/instructions: display metadata for UI.",
      "nextMilestone (optional): next milestone for milestone-based tasks.",
      "cumulativePercentage (optional): current computed grade/progress.",
    ],
    commonErrors: [
      "403 NotAuthorized: missing or invalid API key.",
      "500 InternalFailure: mapping or Google Classroom traversal failure.",
    ],
    examples: [
      {
        title: "Vanilla (RemoteEvent/RemoteFunction style)",
        code: LUA_LIST_TASKS_VANILLA_SNIPPET,
      },
      {
        title: "Knit service style",
        code: LUA_LIST_TASKS_KNIT_SNIPPET,
      },
    ],
  },
  {
    id: "grade-task",
    category: "runtime",
    title: "Set percentage grade for an assigned task",
    method: "PUT",
    path: "/experiences/me/players/{robloxUserId}/tasks/{taskId}/grade",
    summary: "Writes a 0-100 percentage grade for a task instance.",
    whyUseful: "Best for score-based tasks where your game already computes a single percentage.",
    auth: {
      kind: "api-key",
      label: "Partner API key",
      details: "Call from trusted server scripts only. Do not expose the key on clients.",
    },
    requestFields: [
      "robloxUserId (path, required): player being graded.",
      "taskId (path, required): assignment instance ID from ListTasksForPlayer.",
      "percentage (body, required): integer 0..100.",
    ],
    responseFields: [
      "message (string, optional): grading confirmation details.",
    ],
    commonErrors: [
      "400 BadRequest: invalid percentage or missing params.",
      "403 NotAuthorized: API key does not own the task instance.",
      "500 InternalFailure: upstream or persistence failures.",
    ],
    examples: [
      {
        title: "Vanilla (RemoteEvent/RemoteFunction style)",
        code: LUA_GRADE_TASK_VANILLA_SNIPPET,
      },
      {
        title: "Knit service style",
        code: LUA_GRADE_TASK_KNIT_SNIPPET,
      },
    ],
  },
  {
    id: "complete-milestone",
    category: "runtime",
    title: "Mark a milestone complete",
    method: "PUT",
    path: "/experiences/me/players/{robloxUserId}/tasks/{taskId}/milestones/{milestoneId}/completion",
    summary: "Marks a single milestone as complete and returns updated cumulative progress.",
    whyUseful: "Great for objective-based gameplay where progress is event-driven and easier to emit as discrete completions.",
    auth: {
      kind: "api-key",
      label: "Partner API key",
      details: "Milestone IDs must match what you cataloged for that task.",
    },
    requestFields: [
      "robloxUserId (path, required): player ID.",
      "taskId (path, required): assignment instance ID.",
      "milestoneId (path, required): milestone slug from your task catalog definition.",
    ],
    responseFields: [
      "updatedCumulativePercentage (number): total progress after completion.",
      "nextMilestoneId/nextMilestoneName (optional): hint for UI about what is next.",
      "nextMilestonePercentageContribution (optional): expected percentage gain for the next milestone.",
    ],
    commonErrors: [
      "400 BadRequest: malformed task/milestone IDs.",
      "403 NotAuthorized: key does not own this task.",
      "404 NotFound: task or milestone cannot be resolved.",
      "500 InternalFailure: storage or Google Classroom sync issues.",
    ],
    examples: [
      {
        title: "Vanilla (RemoteEvent/RemoteFunction style)",
        code: LUA_COMPLETE_MILESTONE_VANILLA_SNIPPET,
      },
      {
        title: "Knit service style",
        code: LUA_COMPLETE_MILESTONE_KNIT_SNIPPET,
      },
    ],
  },
  {
    id: "list-projects",
    category: "onboarding",
    title: "List your developer projects",
    method: "GET",
    path: "/projects",
    summary: "Returns experience IDs associated with the authenticated developer account.",
    whyUseful: "Powers your dev portal experience picker and helps developers confirm setup state.",
    auth: {
      kind: "cognito",
      label: "Developer Cognito session",
      details: "Used by the web portal after Google + Roblox account linking.",
    },
    requestFields: [
      "No body. Caller identity comes from Cognito authorizer context.",
    ],
    responseFields: [
      "projects (array): each object includes experienceId.",
    ],
    commonErrors: [
      "403 NotAuthorized: user not authenticated or Roblox link missing.",
      "500 InternalFailure: project index query failure.",
    ],
    examples: [],
  },
  {
    id: "create-project",
    category: "onboarding",
    title: "Create a project for an experience",
    method: "POST",
    path: "/projects/{experienceId}",
    summary: "Registers a Roblox experience into the developer portal project model.",
    whyUseful: "This verifies ownership and creates the project record used by onboarding flows.",
    auth: {
      kind: "cognito",
      label: "Developer Cognito session",
      details: "Requires a logged-in developer with linked Roblox identity.",
    },
    requestFields: [
      "experienceId (path, required): Roblox universe/experience ID.",
    ],
    responseFields: [
      "message (string): creation confirmation.",
    ],
    commonErrors: [
      "403 NotAuthorized: caller does not own the experience.",
      "409 Conflict: project already exists.",
      "500 InternalFailure: Roblox verification or persistence failure.",
    ],
    examples: [],
  },
  {
    id: "delegate-roblox-secret-store-access",
    category: "onboarding",
    title: "Delegate Roblox Secret Store access",
    method: "POST",
    path: "/users/me/delegations/roblox-secret-store",
    summary: "Stores a Roblox Open Cloud API key so CivicTech can vend and rotate experience API keys.",
    whyUseful: "This is the bridge that lets the portal install your CivicTechForSchools API key directly into Roblox Secret Store.",
    auth: {
      kind: "cognito",
      label: "Developer Cognito session",
      details: "This is a web-only onboarding call, not a runtime in-game call.",
    },
    requestFields: [
      "apiKey (required): Roblox Open Cloud API key with secret-store permissions.",
      "experienceId (required): Roblox experience ID.",
    ],
    responseFields: [
      "message (string): operation confirmation.",
    ],
    commonErrors: [
      "400 BadRequest: missing apiKey or experienceId.",
      "403 NotAuthorized: caller not authenticated.",
      "500 InternalFailure: failed secure storage write.",
    ],
    examples: [],
  },
  {
    id: "vend-secret",
    category: "onboarding",
    title: "Vend and install a experience API key secret",
    method: "POST",
    path: "/projects/{experienceId}/secret",
    summary: "Creates an API key, binds it to usage plans, encrypts it, and stores it in Roblox Secret Store.",
    whyUseful: "This is the canonical path for provisioning the key your servers will read via HttpService:GetSecret(...).",
    auth: {
      kind: "cognito",
      label: "Developer Cognito session",
      details: "Runs in portal onboarding. Returns a secretId for later reference.",
    },
    requestFields: [
      "experienceId (path, required): target Roblox experience ID.",
    ],
    responseFields: [
      "secretId (string): generated secret identifier.",
    ],
    commonErrors: [
      "403 NotAuthorized: missing delegated Roblox secret-store access.",
      "409 Conflict: secret already exists for the configured domain.",
      "500 InternalFailure: API key creation or Roblox secret write failure.",
    ],
    examples: [],
  },
]

export const experienceGuides: PartnerDocsArticle[] = [
  {
    slug: "getting-started-vanilla-lua",
    kind: "guide",
    title: "Integrating Run the World with CivicTech for Schools (Vanilla Lua case study)",
    summary: "A concrete walkthrough of the Run the World integration pattern using ModuleScripts + RemoteEvents/RemoteFunctions and the modern CivicTechForSchools starter client.",
    audience: "ServerScriptService games without Knit",
    estimatedRead: "18 min",
    updatedOn: "2026-02-16",
    relatedApiIds: [
      "put-experience",
      "catalog-task",
      "list-tasks-for-player",
      "grade-task",
    ],
    sections: [
      {
        heading: "Outcome",
        body: [
          "By the end of this guide, your existing round-based game will register experience metadata, expose teacher-assignable tasks, push assignments to players, and write grades back at round end.",
          "This walkthrough is based on the Run the World integration shape, but updated to use modern `CivicTechForSchools` naming and the current starter client APIs.",
        ],
      },
      {
        heading: "Run the World baseline (before integration)",
        body: [
          "The game already had a round loop, `Lobby` and `Playing` teams, and leaderboard stats (`Points`, `RoundsPlayed`, `Accuracy`).",
          "It already used `ReplicatedStorage` values/events for round state (`InRound`, `CountryPrompt`, `Status`, `HighlightCountry`).",
          "Integration work focused on server-side API calls plus task UI remotes. We did not rework core gameplay systems.",
        ],
      },
      {
        heading: "Step 0: Enable HTTP requests for your Roblox experience",
        body: [
          "Before attempting any CivicTechForSchools API call, open Roblox Creator Hub for your experience and go to \"Experience Settings\".",
          "Enable the toggle labeled \"Allow HTTP Requests\" and save/publish the change.",
          "This is required for both vanilla Studio integrations and Knit/Rojo workflows because both rely on outbound `HttpService` calls.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/00-prerequisite-enable-http-requests-in-experience-settings.png | Roblox Experience Settings showing the Allow HTTP Requests toggle enabled.>>",
        ],
      },
      {
        heading: "Step 1: Add config that reads the API key from Roblox Secret Store",
        body: [
          "Create `ServerScriptService/CivicTechForSchoolsServer/Config.lua`:",
          "local RunService = game:GetService(\"RunService\")\nlocal HttpService = game:GetService(\"HttpService\")\n\nlocal Config = {\n  BaseUrl = \"https://api.prod.school.civictech.llc\",\n  ApiKey = HttpService:GetSecret(\"<your-secret-id>\"),\n  ExperienceProfile = {\n    robloxGameId = \"127120714583972\",\n    -- assetIds = { \"<optional-experience-asset-uuid>\" },\n  },\n  EnableDebugLogging = RunService:IsStudio(),\n}\n\nreturn Config",
          "Do not hardcode raw API keys in scripts. Always load the runtime secret with `HttpService:GetSecret(...)`.",
        ],
      },
      {
        heading: "Step 2: Build a thin integration module around the starter client",
        body: [
          "Use the downloaded `CivicTechForSchoolsService.vanilla.lua` and wrap it with your remote plumbing:",
          "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")\nlocal CivicTechForSchoolsService = require(script.Parent.CivicTechForSchoolsService)\nlocal Config = require(script.Parent.Config)\n\nlocal IntegrationService = {}\nIntegrationService.__index = IntegrationService\n\nlocal function ensureRemote(parent, className, name)\n  local existing = parent:FindFirstChild(name)\n  if existing and existing:IsA(className) then\n    return existing\n  end\n\n  local remote = Instance.new(className)\n  remote.Name = name\n  remote.Parent = parent\n  return remote\nend\n\nlocal function setupRemotes()\n  local folder = ReplicatedStorage:FindFirstChild(\"CivicTechForSchoolsRemotes\")\n  if not folder then\n    folder = Instance.new(\"Folder\")\n    folder.Name = \"CivicTechForSchoolsRemotes\"\n    folder.Parent = ReplicatedStorage\n  end\n\n  return {\n    TaskAssignmentsUpdated = ensureRemote(folder, \"RemoteEvent\", \"TaskAssignmentsUpdated\"),\n    RequestTasks = ensureRemote(folder, \"RemoteFunction\", \"RequestTasks\"),\n  }\nend\n\nfunction IntegrationService.new()\n  local self = setmetatable({}, IntegrationService)\n\n  self.Client = CivicTechForSchoolsService.new({\n    BaseUrl = Config.BaseUrl,\n    ApiKey = Config.ApiKey,\n    EnableDebugLogging = Config.EnableDebugLogging,\n  })\n\n  self.Remotes = setupRemotes()\n  self.Remotes.RequestTasks.OnServerInvoke = function(player)\n    return self:PushTasksToPlayer(player)\n  end\n\n  return self\nend\n\nfunction IntegrationService:PushTasksToPlayer(player)\n  if not player:IsA(\"Player\") then\n    return { success = false, message = \"Expected Player instance\" }\n  end\n\n  local payload, err = self.Client:ListTasksForPlayer(player)\n  if err then\n    self.Remotes.TaskAssignmentsUpdated:FireClient(player, { success = false, error = err })\n    return { success = false, error = err }\n  end\n\n  self.Remotes.TaskAssignmentsUpdated:FireClient(player, { success = true, payload = payload })\n  return { success = true, tasks = payload.tasks or {} }\nend\n\nreturn IntegrationService.new()",
        ],
      },
      {
        heading: "Step 3: Register experience metadata and catalog tasks at startup",
        body: [
          "In your server init script, call `PutExperience` once and register the tasks teachers can assign:",
          "local Players = game:GetService(\"Players\")\n\nlocal Integration = require(script.Parent.IntegrationService)\nlocal Config = require(script.Parent.Config)\n\nlocal function callOrWarn(label, response, err)\n  if err then\n    warn(label .. \" failed: \" .. tostring(err.message))\n  end\n  return response\nend\n\ncallOrWarn(\"PutExperience\", Integration.Client:PutExperience(Config.ExperienceProfile))\n\ncallOrWarn(\"CatalogTask:get-80-percent-accuracy\", Integration.Client:CatalogTask(\"get-80-percent-accuracy-across-10-rounds\", {\n  name = \"Get 80% Accuracy In 10 Rounds\",\n  subheading = \"Have at least 80 percent accuracy after at least ten rounds\",\n  instructions = \"Try to keep high accuracy across ten rounds.\",\n}))\n\ncallOrWarn(\"CatalogTask:get-100-points\", Integration.Client:CatalogTask(\"get-100-points\", {\n  name = \"Get 100 Points\",\n  subheading = \"Obtain at least 100 points in one session\",\n  instructions = \"Get points by selecting the correct country as quickly as possible.\",\n  assetIds = { \"3a3573f1-1312-4f1f-9bed-9973b159dbcd\" },\n}))",
          "Keep `entryId` values stable once published, because grading logic depends on them.",
        ],
      },
      {
        heading: "Step 4: Push task assignments when players join",
        body: [
          "Use your integration module to push tasks immediately for both new and already-connected players:",
          "local Players = game:GetService(\"Players\")\nlocal Integration = require(script.Parent.IntegrationService)\n\nlocal function push(player)\n  task.defer(function()\n    Integration:PushTasksToPlayer(player)\n  end)\nend\n\nPlayers.PlayerAdded:Connect(push)\nfor _, player in ipairs(Players:GetPlayers()) do\n  push(player)\nend",
        ],
      },
      {
        heading: "Step 5: Grade assignments at round end using existing game stats",
        body: [
          "Attach this logic to your existing `InRound.Changed` flow. On round end, list assignments and write grades:",
          "local Players = game:GetService(\"Players\")\nlocal ReplicatedStorage = game:GetService(\"ReplicatedStorage\")\n\nlocal Integration = require(script.Parent.IntegrationService)\nlocal inRound = ReplicatedStorage:WaitForChild(\"InRound\")\n\ninRound.Changed:Connect(function()\n  if inRound.Value == true then\n    return\n  end\n\n  for _, player in ipairs(Players:GetPlayers()) do\n    local taskResponse, listErr = Integration.Client:ListTasksForPlayer(player)\n    if listErr or not taskResponse then\n      continue\n    end\n\n    for _, classroomTask in ipairs(taskResponse.tasks or {}) do\n      if classroomTask.entryId == \"get-100-points\" then\n        local score = player.leaderstats.Points.Value\n        Integration.Client:GradeTask(player, classroomTask.taskId, math.clamp(score, 0, 100))\n      elseif classroomTask.entryId == \"get-80-percent-accuracy-across-10-rounds\" then\n        local rounds = player.leaderstats.RoundsPlayed.Value\n        local accuracy = player.leaderstats.Accuracy.Value\n        if rounds >= 10 and accuracy >= 80 then\n          Integration.Client:GradeTask(player, classroomTask.taskId, 100)\n        end\n      end\n    end\n\n    Integration:PushTasksToPlayer(player)\n  end\nend)",
          "Use `player` directly when calling `ListTasksForPlayer` / `GradeTask`; the starter client handles Player-to-userId normalization safely.",
        ],
      },
      {
        heading: "Step 6: Bind your existing task UI to the remotes",
        body: [
          "Your local script only needs to invoke once and subscribe for updates:",
          "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")\n\nlocal remotes = ReplicatedStorage:WaitForChild(\"CivicTechForSchoolsRemotes\")\nlocal RequestTasks = remotes:WaitForChild(\"RequestTasks\") :: RemoteFunction\nlocal TaskAssignmentsUpdated = remotes:WaitForChild(\"TaskAssignmentsUpdated\") :: RemoteEvent\n\nlocal function renderTasks(tasks)\n  -- Use your existing task panel rendering here.\n  -- Example input shape: { { name = \"...\", subheading = \"...\", cumulativePercentage = 40, ... } }\nend\n\nTaskAssignmentsUpdated.OnClientEvent:Connect(function(response)\n  if response and response.success then\n    renderTasks(response.payload.tasks or {})\n  end\nend)\n\nlocal initial = RequestTasks:InvokeServer()\nif initial and initial.success then\n  renderTasks(initial.tasks or {})\nend",
          "This keeps gameplay-authoritative logic on the server while still giving the client live assignment updates.",
        ],
      },
      {
        heading: "Modernization notes (from older Gallaudet examples)",
        body: [
          "Use `CivicTechForSchoolsService` naming in module names, remotes, and UI labels instead of `Gallaudet`.",
          "Use `PutExperience` (not `PutPartner`) and `/experiences/me` paths from the current API.",
          "Current catalog shapes support optional `assetIds` on both task and milestone records; include them whenever your game wants task visuals in classroom surfaces.",
        ],
      },
    ],
  },
  {
    slug: "getting-started-knit-fusion",
    kind: "guide",
    title: "Getting started with Knit (Fusion optional)",
    summary: "Integrate the Knit starter client end-to-end: server config, startup sync, task push signal, client controller subscription, and gameplay writes.",
    audience: "Games using Knit service/controller architecture",
    estimatedRead: "18 min",
    updatedOn: "2026-02-16",
    relatedApiIds: [
      "put-experience",
      "catalog-task",
      "list-tasks-for-player",
      "grade-task",
      "complete-milestone",
    ],
    sections: [
      {
        heading: "Outcome",
        body: [
          "By the end of this guide, your game server will publish task updates through a Knit signal and your client controller will react to assignment changes.",
          "Fusion is optional. The integration pattern is Knit-first: service -> signal -> controller -> UI layer.",
        ],
      },
      {
        heading: "Prerequisite: Enable HTTP requests for your Roblox experience",
        body: [
          "Before attempting any CivicTechForSchools API call, open Roblox Creator Hub for your experience and go to \"Experience Settings\".",
          "Enable the toggle labeled \"Allow HTTP Requests\" and save/publish the change.",
          "This is required for both vanilla Studio integrations and Knit/Rojo workflows because both rely on outbound `HttpService` calls.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/00-prerequisite-enable-http-requests-in-experience-settings.png | Roblox Experience Settings showing the Allow HTTP Requests toggle enabled.>>",
        ],
      },
      {
        heading: "Recommended file layout",
        body: [
          "Use this layout so the starter service and config resolve cleanly:",
          "src\n  Server\n    Services\n      CivicTechForSchoolsService.lua\n      TaskCatalogBootstrapService.lua\n      RoundGradingService.lua\n    Modules\n      Config\n        CivicTechForSchools.lua\n  Client\n    Controllers\n      TaskBannerController.lua",
        ],
      },
      {
        heading: "Step 1: Add Knit config for the starter service",
        body: [
          "Create `src/Server/Modules/Config/CivicTechForSchools.lua`:",
          "local RunService = game:GetService(\"RunService\")\n\nlocal Config = {\n  BaseUrl = \"https://api.prod.school.civictech.llc\",\n  ApiKey = game:GetService(\"HttpService\"):GetSecret(\"<your-secret-id>\"),\n  ExperienceProfile = {\n    robloxGameId = \"1234567890\",\n    -- assetIds = { \"<optional-asset-uuid>\" },\n  },\n  EnableDebugLogging = RunService:IsStudio(),\n}\n\nreturn Config",
          "The starter Knit service requires exactly this module path: `self.Modules.Config.CivicTechForSchools`.",
        ],
      },
      {
        heading: "Step 2: Install the starter Knit service",
        body: [
          "Copy `CivicTechForSchoolsService.knit.lua` into your server Knit services folder (for example `src/Server/Services/CivicTechForSchoolsService.lua`).",
          "What it gives you out of the box: `PutExperience` on startup, `PushTasksToPlayer` for player joins, and a client signal named `TaskAssignmentsUpdated`.",
        ],
      },
      {
        heading: "Step 3: Bootstrap task catalog entries on server startup",
        body: [
          "Add a second service dedicated to one-time startup registration:",
          "local ReplicatedStorage = game:GetService(\"ReplicatedStorage\")\nlocal Knit = require(ReplicatedStorage.Packages.Knit)\n\nlocal TaskCatalogBootstrapService = Knit.CreateService({\n  Name = \"TaskCatalogBootstrapService\",\n  Client = {},\n})\n\nfunction TaskCatalogBootstrapService:KnitStart()\n  local cts = Knit.GetService(\"CivicTechForSchoolsService\")\n\n  cts:CatalogTask(\"get-100-points\", {\n    name = \"Get 100 Points\",\n    subheading = \"Obtain at least 100 points in one session\",\n    instructions = \"Get points by selecting the correct country quickly.\",\n    -- assetIds = { \"<optional-asset-uuid>\" },\n    milestones = {\n      { id = \"reach-50-points\", name = \"Reach 50 points\", percentageContribution = 50 },\n      { id = \"reach-100-points\", name = \"Reach 100 points\", percentageContribution = 50 },\n    },\n  })\nend\n\nreturn TaskCatalogBootstrapService",
          "Keep this separate from round/gameplay services so startup concerns and runtime concerns do not mix.",
        ],
      },
      {
        heading: "Step 4: Subscribe from a Knit client controller",
        body: [
          "Client controllers should only consume the signal payload and map it into view state:",
          "local Knit = require(game:GetService(\"ReplicatedStorage\").Packages.Knit)\n\nlocal TaskBannerController = Knit.CreateController({\n  Name = \"TaskBannerController\",\n})\n\nfunction TaskBannerController:KnitInit()\n  self.CtsService = Knit.GetService(\"CivicTechForSchoolsService\")\nend\n\nfunction TaskBannerController:KnitStart()\n  self._connection = self.CtsService.TaskAssignmentsUpdated:Connect(function(response)\n    if not response or response.success == false then\n      self:HideBanner()\n      return\n    end\n\n    local tasks = response.payload and response.payload.tasks or {}\n    if #tasks == 0 then\n      self:HideBanner()\n      return\n    end\n\n    local task = tasks[1]\n    local nextMilestone = task.nextMilestone\n\n    self:ShowBanner({\n      title = task.name,\n      subtitle = (nextMilestone and nextMilestone.name) or task.subheading,\n      completion = task.cumulativePercentage or 0,\n    })\n  end)\nend\n\nreturn TaskBannerController",
          "If you use Fusion, Roact, or plain ScreenGuis, keep that inside `ShowBanner`/`HideBanner` only.",
        ],
      },
      {
        heading: "Step 5: Write progress from gameplay events",
        body: [
          "At meaningful checkpoints (round end, objective completion), look up tasks and write either grade or milestone completion:",
          "local Players = game:GetService(\"Players\")\nlocal ReplicatedStorage = game:GetService(\"ReplicatedStorage\")\nlocal Knit = require(ReplicatedStorage.Packages.Knit)\n\nlocal cts = Knit.GetService(\"CivicTechForSchoolsService\")\n\nlocal function gradeRound(player, computedPercentage)\n  local taskList, err = cts:ListTasksForPlayer(player)\n  if err or not taskList then\n    return\n  end\n\n  for _, task in ipairs(taskList.tasks or {}) do\n    if task.entryId == \"get-100-points\" then\n      cts:GradeTask(player, task.taskId, { percentage = math.clamp(computedPercentage, 0, 100) })\n    end\n  end\n\n  cts:PushTasksToPlayer(player)\nend\n\nlocal function completeObjective(player, taskId, milestoneId)\n  cts:CompleteMilestone(player, taskId, milestoneId)\n  cts:PushTasksToPlayer(player)\nend",
          "Choose one write model per task family: `GradeTask` for score-based tasks, `CompleteMilestone` for objective-based tasks.",
        ],
      },
    ],
  },
  {
    slug: "bootstrapping-secrets-and-api-keys",
    kind: "guide",
    title: "Bootstrapping secrets and API keys",
    summary: "Create your project, delegate Roblox Secret Store access, create your CivicTechForSchools runtime secret, and wire it into the starter client files.",
    audience: "Partner developers provisioning a Roblox experience for first API calls",
    estimatedRead: "15 min",
    updatedOn: "2026-02-15",
    relatedApiIds: [
      "put-experience",
    ],
    sections: [
      {
        heading: "Outcome",
        body: [
          "By the end of this guide, your Roblox universe will have a CivicTechForSchools API key stored in Roblox Secret Store, and your game server code will load it via HttpService:GetSecret(...) without hardcoding credentials.",
          "This flow is intended for first-time onboarding and should be repeated whenever you rotate credentials.",
        ],
      },
      {
        heading: "Prerequisites",
        body: [
          "- You are signed into the developer portal at https://school.civictech.llc/create/",
          "- You know your Roblox universe ID (not place ID).",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/00-gleaning-your-experience-id.png | The two-step process required to determine the experience by first navigating to https://create.roblox.com/dashboard/creations?activeTab=SharedExperiences, clicking the relevant experience, and then reading the experience ID from the URL path parameter.>>",
        ],
      },
      {
        heading: "Step 1: Create your project in /create",
        body: [
          "In https://school.civictech.llc/create, click \"Add experience\" and enter your numeric universe ID, then click \"Confirm\".",
          "If you accidentally paste a place ID, the UI will suggest the matching universe ID. Use the universe ID it provides.",
          "After creation, select that experience in the sidebar dropdown, then open the Secrets feature.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/01-add-a-roblox-experience-dialog.png | Add a Roblox experience dialog with Universe ID field and Confirm button.>>",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/01-developer-console-with-secrets-panel-visible.png | Developer console after selecting the experience, with the Secrets panel visible.>>",
        ],
      },
      {
        heading: "Step 2: Create a Roblox Open Cloud API key with the correct scopes",
        body: [
          "Go to https://create.roblox.com/dashboard/credentials and click \"Create API key\".",
          "The key must include both secret permissions: secret-store:write and secret-store:read. We recommend you restrict the key to just the experience this project relates to.",
          "Note that the `secret-store:read` scope does NOT let us read secret values; it allows metadata/list operations required for health checks and future rotation workflows.",
          "Copy the generated key value immediately. Roblox only shows the full value when it is created.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/02-the-roblox-credentials-dashboard-showing-no-api-keys-exist-yet-with-a-create-api-key-button-in-the-center.png | Roblox credentials dashboard with no API keys yet and the Create API key button highlighted.>>",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/02-the-roblox-create-api-key-form-filled-out-with-correct-secret-store-scopes.png | Roblox Create API key form completed for the universe with secret-store:write and secret-store:read selected.>>",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/02-the-roblox-create-api-key-page-showing-the-api-key-with-a-button-to-copy-key-to-clipboard.png | Roblox API key creation confirmation page showing the generated key and the copy-to-clipboard button.>>",
        ],
      },
      {
        heading: "Step 3: Save the Roblox API key in CivicTechForSchools",
        body: [
          "Return to https://school.civictech.llc/create, keep the same experience selected, and stay on Secrets.",
          "In \"Step 1: Save Roblox API key\", paste the Roblox key and click \"Save API key\".",
          "Wait for the success toast before moving on. The next step depends on this delegation being stored.",
          "Important sequencing: you cannot successfully create the CivicTechForSchools secret until \"Save API key\" has completed for this experience.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/03-secrets-panel-after-adding-the-api-secret-but-before-pressing-the-save-api-key-button.png | Secrets panel with the Roblox API key entered before pressing Save API key.>>",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/03-secrets-panel-after-clicking-the-save-api-key-button-and-with-a-success-toast-showing.png | Secrets panel after clicking Save API key with a success toast visible.>>",
        ],
      },
      {
        heading: "Step 4: Create the CivicTechForSchools runtime secret",
        body: [
          "In the same Secrets panel, click \"Create secret\" in \"Step 2: Create a secret\".",
          "When successful, you will see a toast containing a generated secret ID (for example: rdvdhfzvfahk). Save this ID; your Roblox game code will use it with HttpService:GetSecret(\"<secretId>\").",
          "Under the hood, this action creates an API key, attaches usage plan limits, encrypts it with Roblox's public key, and writes the encrypted value into your universe's Secret Store.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/04-secrets-panel-after-clicking-create-secret-button-with-success-toast-showing.png | Secrets panel after clicking Create secret with a success toast visible.>>",
        ],
      },
      {
        heading: "Step 5: Verify the secret exists in Roblox",
        body: [
          "Open https://create.roblox.com/dashboard/creations/experiences/<yourExperienceId>/secrets and confirm the new secret ID appears.",
          "You should verify the ID matches the one returned by the developer portal toast.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/05-roblox-creator-dashboard-showing-secret-now-exists-in-secret-store-for-experience.png | Roblox Creator Hub Secrets Store panel for selected experience showing a new secret exists in the Secret Store.>>",
        ],
      },
      {
        heading: "Step 6: Update your code to use the secret",
        body: [
          "Update your server-side code so it reads the secret ID from Roblox Secret Store instead of hardcoding an API key.",
          "Example:",
          "local HttpService = game:GetService(\"HttpService\")\nlocal CtsSecret = HttpService:GetSecret(\"zokziodofslk\")",
          "Replace `zokziodofslk` with your actual secret name.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/06-roblox-studio-ide-showing-config.png | Roblox Studio showing config code that reads the secret with HttpService:GetSecret(\"<secretId>\").>>",
        ],
      },
    ],
  },
]

export const experienceExplainers: PartnerDocsArticle[] = [
  {
    slug: "milestone-based-tasks",
    kind: "explainer",
    title: "Milestone-based tasks",
    summary: "Understand why milestones often reduce API complexity for objective-driven gameplay.",
    audience: "Gameplay engineers and curriculum designers",
    estimatedRead: "7 min",
    updatedOn: "2026-02-10",
    relatedApiIds: [
      "catalog-task",
      "list-tasks-for-player",
      "complete-milestone",
    ],
    sections: [
      {
        heading: "When milestones are a strong fit",
        body: [
          "Your task naturally breaks into objective events (visit room, complete dialogue, pass checkpoint).",
          "You want deterministic, append-only progress writes instead of recalculating full percentages each loop.",
        ],
      },
      {
        heading: "Why they are operationally simpler",
        body: [
          "Each milestone completion call is idempotent-friendly and easier to reason about during retries.",
          "The backend returns updatedCumulativePercentage and next milestone hints, which helps drive player UI without extra state lookups.",
        ],
      },
      {
        heading: "Tradeoffs",
        body: [
          "Milestones require careful up-front catalog design and stable milestone IDs.",
          "For purely score-driven gameplay, GradeTask can still be the most direct option.",
        ],
      },
    ],
  },
]

export const partnerClientDownloads: PartnerClientDownload[] = [
  {
    id: "vanilla-client",
    title: "Vanilla Lua starter client",
    summary: "Drop-in server module for games using RemoteFunction/RemoteEvent patterns.",
    href: "/downloads/civictech-for-schools-client/latest/CivicTechForSchoolsService.vanilla.lua",
    format: "lua",
    updatedOn: "2026-02-16",
    audience: "Developers who code within Roblox Studio",
  },
  {
    id: "knit-client",
    title: "Knit service starter client",
    summary: "Knit-style starter service that pushes task updates to clients.",
    href: "/downloads/civictech-for-schools-client/latest/CivicTechForSchoolsService.knit.lua",
    format: "lua",
    updatedOn: "2026-02-16",
    audience: "Developers who code within VSCode using Knit/Rojo",
  },
]

export const getGuideBySlug = (slug: string) =>
  experienceGuides.find((guide) => guide.slug === slug)

export const getExplainerBySlug = (slug: string) =>
  experienceExplainers.find((explainer) => explainer.slug === slug)

export const getPartnerApiById = (id: string) =>
  experienceApiResources.find((resource) => resource.id === id)
