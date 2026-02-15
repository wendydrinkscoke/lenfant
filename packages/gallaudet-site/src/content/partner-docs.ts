export type PartnerApiAuthMode = {
  kind: "api-key" | "cognito"
  label: string
  details: string
}

export type PartnerApiExample = {
  title: string
  language: "lua" | "bash" | "json"
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

const LUA_HTTP_HELPER_SNIPPET = [
  "local HttpService = game:GetService(\"HttpService\")",
  "",
  "local function request(method, baseUrl, path, apiKey, body)",
  "  local requestData = {",
  "    Url = baseUrl .. path,",
  "    Method = method,",
  "    Headers = {",
  "      [\"Content-Type\"] = \"application/json\",",
  "      [\"x-api-key\"] = apiKey,",
  "    },",
  "  }",
  "",
  "  if body ~= nil then",
  "    requestData.Body = HttpService:JSONEncode(body)",
  "  end",
  "",
  "  local ok, response = pcall(function()",
  "    return HttpService:RequestAsync(requestData)",
  "  end)",
  "",
  "  if not ok or not response.Success then",
  "    return nil, response and response.Body or \"request failed\"",
  "  end",
  "",
  "  if response.Body == \"\" then",
  "    return {}, nil",
  "  end",
  "",
  "  return HttpService:JSONDecode(response.Body), nil",
  "end",
].join("\n")

const LUA_KNIT_SNIPPET = [
  "local Knit = require(game:GetService(\"ReplicatedStorage\").Packages.Knit)",
  "",
  "local GallaudetService = Knit.CreateService({",
  "  Name = \"GallaudetService\",",
  "  Client = {",
  "    TaskAssignmentsUpdated = Knit.CreateSignal(),",
  "  },",
  "})",
  "",
  "function GallaudetService:PushTasksToPlayer(player)",
  "  local response, err = self:ListTasksForPlayer(player)",
  "  if err then",
  "    self.Client.TaskAssignmentsUpdated:Fire(player, { success = false, message = err.message })",
  "    return nil, err",
  "  end",
  "",
  "  self.Client.TaskAssignmentsUpdated:Fire(player, {",
  "    success = true,",
  "    payload = response,",
  "  })",
  "",
  "  return response, nil",
  "end",
].join("\n")

const CURL_PUT_PARTNER = [
  "curl -X PUT 'https://api.prod.school.civictech.llc/experiences/me' \\",
  "  -H 'Content-Type: application/json' \\",
  "  -H 'x-api-key: <YOUR_GALLAUDET_API_KEY>' \\",
  "  -d '{",
  "    \"experienceName\": \"Run the World - Learn Country Names!\",",
  "    \"robloxGameId\": \"9228429469\"",
  "  }'",
].join("\n")

const CURL_CATALOG_TASK = [
  "curl -X PUT 'https://api.prod.school.civictech.llc/task-catalog/get-100-points' \\",
  "  -H 'Content-Type: application/json' \\",
  "  -H 'x-api-key: <YOUR_GALLAUDET_API_KEY>' \\",
  "  -d '{",
  "    \"name\": \"Get 100 Points\",",
  "    \"subheading\": \"Obtain at least 100 points in one session\",",
  "    \"instructions\": \"Get points by selecting the correct country quickly.\",",
  "    \"milestones\": [",
  "      { \"id\": \"reach-50-points\", \"name\": \"Reach 50 points\", \"percentageContribution\": 50 },",
  "      { \"id\": \"reach-100-points\", \"name\": \"Reach 100 points\", \"percentageContribution\": 50 }",
  "    ]",
  "  }'",
].join("\n")

const LUA_GRADE_TASK_SNIPPET = [
  "function service:GradeTask(playerId, taskId, percentage)",
  "  local result, err = self:_request(",
  "    \"PUT\",",
  "    \"/experiences/me/players/\" .. playerId .. \"/tasks/\" .. taskId .. \"/grade\",",
  "    { percentage = percentage }",
  "  )",
  "",
  "  if err then",
  "    warn(\"GradeTask failed:\", err.message)",
  "    return nil, err",
  "  end",
  "",
  "  return result, nil",
  "end",
].join("\n")

const LUA_MILESTONE_SNIPPET = [
  "local result, err = service:_request(",
  "  \"PUT\",",
  "  \"/experiences/me/players/\" .. player.UserId .. \"/tasks/\" .. taskId .. \"/milestones/visit-capitol/completion\"",
  ")",
  "",
  "if err then",
  "  warn(\"CompleteMilestone failed:\", err.message)",
  "  return",
  "end",
  "",
  "print(\"Updated cumulative percentage:\", result.updatedCumulativePercentage)",
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
      "experienceName (string, required): Human-friendly game name.",
      "robloxGameId (string, required): Numeric Roblox place/game identifier.",
    ],
    responseFields: [
      "message (string): Confirmation text such as 'Partner profile saved'.",
    ],
    commonErrors: [
      "403 NotAuthorized: missing or invalid API key.",
      "400 BadRequest: malformed experienceName or robloxGameId.",
      "500 InternalFailure: backend persistence failure.",
    ],
    examples: [
      {
        title: "cURL",
        language: "bash",
        code: CURL_PUT_PARTNER,
      },
      {
        title: "Lua helper for Roblox server scripts",
        language: "lua",
        code: LUA_HTTP_HELPER_SNIPPET,
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
        title: "cURL",
        language: "bash",
        code: CURL_CATALOG_TASK,
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
        title: "Lua (vanilla remotes approach)",
        language: "lua",
        code: [
          "function service:ListTasksForPlayer(player)",
          "  local robloxUserId = tostring(player.UserId)",
          "  local result, err = self:_request(\"GET\", \"/experiences/me/players/\" .. robloxUserId .. \"/tasks\")",
          "",
          "  if err then",
          "    self.Remotes.TaskAssignmentsUpdated:FireClient(player, { success = false, error = err })",
          "    return nil, err",
          "  end",
          "",
          "  self.Remotes.TaskAssignmentsUpdated:FireClient(player, {",
          "    success = true,",
          "    payload = result,",
          "  })",
          "",
          "  return result, nil",
          "end",
        ].join("\n"),
      },
      {
        title: "Lua (Knit service push pattern)",
        language: "lua",
        code: LUA_KNIT_SNIPPET,
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
        title: "Lua",
        language: "lua",
        code: LUA_GRADE_TASK_SNIPPET,
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
        title: "Lua",
        language: "lua",
        code: LUA_MILESTONE_SNIPPET,
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
    whyUseful: "This is the bridge that lets the portal install your Gallaudet API key directly into Roblox Secret Store.",
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
    title: "Getting started with vanilla Roblox Lua",
    summary: "Wire up experience profile registration, task cataloging, and player task retrieval using RemoteEvents/RemoteFunctions.",
    audience: "ServerScriptService integrations without Knit",
    estimatedRead: "12 min",
    updatedOn: "2026-02-10",
    relatedApiIds: [
      "put-experience",
      "catalog-task",
      "list-tasks-for-player",
      "grade-task",
    ],
    sections: [
      {
        heading: "What this guide builds",
        body: [
          "A lightweight service module that wraps RequestAsync and signs experience calls with x-api-key.",
          "A simple Task UI flow where players can fetch and view teacher-assigned tasks.",
          "Round-end grading that updates assignment progress in Google Classroom.",
        ],
      },
      {
        heading: "Implementation notes",
        body: [
          "Keep API keys in Roblox Secret Store and load them with HttpService:GetSecret instead of hardcoding.",
          "Call PutExperience and CatalogTask at server startup so teacher-assignment metadata stays fresh.",
          "Fetch tasks when players join and whenever your game needs to refresh assignment UI.",
        ],
      },
      {
        heading: "Where to extend",
        body: [
          "Replace direct grade writes with milestone completions for objective-heavy tasks.",
          "Add telemetry around retries and HTTP status codes to make experience support easier.",
        ],
      },
    ],
  },
  {
    slug: "getting-started-knit-fusion",
    kind: "guide",
    title: "Getting started with Knit + Fusion",
    summary: "Expose task assignment updates through Knit signals and render assignment progress with Fusion UI components.",
    audience: "Games using Knit service/controller architecture",
    estimatedRead: "10 min",
    updatedOn: "2026-02-10",
    relatedApiIds: [
      "list-tasks-for-player",
      "grade-task",
      "complete-milestone",
    ],
    sections: [
      {
        heading: "What this guide builds",
        body: [
          "A server-side Knit service that wraps the same experience runtime endpoints.",
          "A client controller that reacts to TaskAssignmentsUpdated and updates banner UI state.",
          "A Fusion element with title, subtitle, and progress indicator from cumulativePercentage.",
        ],
      },
      {
        heading: "Implementation notes",
        body: [
          "Keep transport concerns in the service layer and keep UI controllers focused on data projection.",
          "Use nextMilestone to display the next objective when tasks are milestone-based.",
          "Push fresh tasks after each grade/milestone mutation so player UI stays eventually consistent.",
        ],
      },
      {
        heading: "Where to extend",
        body: [
          "Support multiple simultaneous tasks in your banner by rotating or stacking UI cards.",
          "Emit task-related analytics events for completion rate and milestone drop-off analysis.",
        ],
      },
    ],
  },
  {
    slug: "bootstrapping-secrets-and-api-keys",
    kind: "guide",
    title: "Bootstrapping secrets and API keys",
    summary: "Create your project, delegate Roblox Secret Store access, create your Gallaudet runtime secret, and wire it into the starter client files.",
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
          "By the end of this guide, your Roblox universe will have a Gallaudet API key stored in Roblox Secret Store, and your game server code will load it via HttpService:GetSecret(...) without hardcoding credentials.",
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
        heading: "Step 3: Save the Roblox API key in Gallaudet",
        body: [
          "Return to https://school.civictech.llc/create, keep the same experience selected, and stay on Secrets.",
          "In \"Step 1: Save Roblox API key\", paste the Roblox key and click \"Save API key\".",
          "Wait for the success toast before moving on. The next step depends on this delegation being stored.",
          "Important sequencing: you cannot successfully create the Gallaudet secret until \"Save API key\" has completed for this experience.",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/03-secrets-panel-after-adding-the-api-secret-but-before-pressing-the-save-api-key-button.png | Secrets panel with the Roblox API key entered before pressing Save API key.>>",
          "<<Screenshot: /docs/guides/bootstrapping-secrets-and-api-keys/03-secrets-panel-after-clicking-the-save-api-key-button-and-with-a-success-toast-showing.png | Secrets panel after clicking Save API key with a success toast visible.>>",
        ],
      },
      {
        heading: "Step 4: Create the Gallaudet runtime secret",
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
          "Open https://create.roblox.com/dashboard/creations/experiences/${yourExperienceId}/secrets and confirm the new secret ID appears.",
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
  {
    slug: "grade-task-vs-complete-milestone",
    kind: "explainer",
    title: "GradeTask vs CompleteMilestone",
    summary: "Choose the right write API based on whether progress is computed continuously or emitted as discrete objectives.",
    audience: "Server-side gameplay and backend integration engineers",
    estimatedRead: "6 min",
    updatedOn: "2026-02-10",
    relatedApiIds: ["grade-task", "complete-milestone"],
    sections: [
      {
        heading: "Use GradeTask when",
        body: [
          "Your game continuously computes a percentage like accuracy or score normalizations.",
          "You already have a single authoritative number at meaningful checkpoints.",
        ],
      },
      {
        heading: "Use CompleteMilestone when",
        body: [
          "Progress is event-based and easier to emit as individual completions.",
          "You want backend-managed cumulative percentage and next-milestone hints.",
        ],
      },
      {
        heading: "Hybrid pattern",
        body: [
          "Use milestone tasks for objective progression and GradeTask for performance overlays where needed.",
        ],
      },
    ],
  },
]

export const partnerClientDownloads: PartnerClientDownload[] = [
  {
    id: "client-readme",
    title: "Gallaudet client pack README",
    summary: "High-level setup and environment guidance for Roblox integrations.",
    href: "/downloads/gallaudet-client/latest/README.txt",
    format: "txt",
    updatedOn: "2026-02-10",
    audience: "All experience developers",
  },
  {
    id: "vanilla-client",
    title: "Vanilla Lua starter client",
    summary: "Drop-in server module for games using RemoteFunction/RemoteEvent patterns.",
    href: "/downloads/gallaudet-client/latest/GallaudetService.vanilla.lua",
    format: "lua",
    updatedOn: "2026-02-10",
    audience: "ServerScriptService + remotes architecture",
  },
  {
    id: "knit-client",
    title: "Knit service starter client",
    summary: "Knit-style starter service that pushes task updates to clients.",
    href: "/downloads/gallaudet-client/latest/GallaudetService.knit.lua",
    format: "lua",
    updatedOn: "2026-02-10",
    audience: "Knit/Fusion/Rojo architecture",
  },
]

export const getGuideBySlug = (slug: string) =>
  experienceGuides.find((guide) => guide.slug === slug)

export const getExplainerBySlug = (slug: string) =>
  experienceExplainers.find((explainer) => explainer.slug === slug)

export const getPartnerApiById = (id: string) =>
  experienceApiResources.find((resource) => resource.id === id)
