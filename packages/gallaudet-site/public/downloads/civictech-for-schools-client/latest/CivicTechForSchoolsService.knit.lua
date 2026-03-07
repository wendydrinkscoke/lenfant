--!strict
-- CivicTechForSchoolsService.knit.lua
-- Starter scaffold for Knit-based Roblox games.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local Knit = require(ReplicatedStorage.Packages.Knit)

local CivicTechForSchoolsService = Knit.CreateService({
  Name = "CivicTechForSchoolsService",
  Client = {
    TaskAssignmentsUpdated = Knit.CreateSignal(),
  },
})

type AssetId = string
type AssetIds = { AssetId }

type Milestone = {
  id: string,
  name: string,
  percentageContribution: number,
  assetIds: AssetIds?,
}

type ExperienceProfile = {
  robloxGameId: string,
  assetIds: AssetIds?,
}

type CatalogTaskRequest = {
  name: string,
  subheading: string,
  instructions: string,
  assetIds: AssetIds?,
  milestones: { Milestone }?,
}

type GradeTaskRequest = {
  percentage: number,
}

type Config = {
  BaseUrl: string,
  ApiKey: string,
  ExperienceProfile: ExperienceProfile,
  EnableDebugLogging: boolean?,
}

local function encodePathSegment(value: string): string
  return HttpService:UrlEncode(value)
end

local function normalizeUserId(playerOrUserId: Player | string | number): string
  local variant = typeof(playerOrUserId)
  if variant == "Instance" then
    assert((playerOrUserId :: Instance):IsA("Player"), "Expected playerOrUserId Instance to be a Player")
    return tostring((playerOrUserId :: Player).UserId)
  end

  if variant == "string" then
    assert(playerOrUserId ~= "", "Expected playerOrUserId string to be non-empty")
    return playerOrUserId :: string
  end

  assert(variant == "number", "Expected playerOrUserId to be a Player, string, or number")
  return tostring(playerOrUserId :: number)
end

function CivicTechForSchoolsService:_log(...)
  if self.EnableDebugLogging then
    print("[CivicTechForSchoolsService]", ...)
  end
end

function CivicTechForSchoolsService:_request(method: string, path: string, body: any?)
  local requestData = {
    Url = self.BaseUrl .. path,
    Method = method,
    Headers = {
      ["Content-Type"] = "application/json",
      ["Accept"] = "application/json",
      ["x-api-key"] = self.ApiKey,
    },
  }

  if body ~= nil then
    requestData.Body = HttpService:JSONEncode(body)
  end

  local ok, response = pcall(function()
    return HttpService:RequestAsync(requestData)
  end)

  if not ok then
    return nil, { message = "RequestAsync failed", details = tostring(response) }
  end

  if not response.Success then
    return nil, {
      statusCode = response.StatusCode,
      message = string.format("HTTP %d %s", response.StatusCode, response.StatusMessage),
      rawBody = response.Body,
    }
  end

  if response.Body == nil or response.Body == "" then
    return {}, nil
  end

  local parseOk, parsed = pcall(function()
    return HttpService:JSONDecode(response.Body)
  end)

  if not parseOk then
    return nil, { message = "Invalid JSON response", rawBody = response.Body }
  end

  return parsed, nil
end

function CivicTechForSchoolsService:PutExperience(profile: ExperienceProfile?)
  local payload = profile or self.ExperienceProfile
  return self:_request("PUT", "/experiences/me", payload)
end

function CivicTechForSchoolsService:CatalogTask(entryId: string, request: CatalogTaskRequest)
  return self:_request("PUT", "/task-catalog/" .. encodePathSegment(entryId), request)
end

function CivicTechForSchoolsService:ListTasksForPlayer(playerOrUserId: Player | string | number)
  local userId = normalizeUserId(playerOrUserId)

  return self:_request("GET", "/experiences/me/players/" .. encodePathSegment(userId) .. "/tasks")
end

function CivicTechForSchoolsService:GradeTask(
  playerOrUserId: Player | string | number,
  taskId: string,
  requestOrPercentage: GradeTaskRequest | number
)
  local userId = normalizeUserId(playerOrUserId)

  local request: GradeTaskRequest
  if type(requestOrPercentage) == "table" then
    request = requestOrPercentage
  else
    request = { percentage = requestOrPercentage }
  end

  return self:_request(
    "PUT",
    "/experiences/me/players/" .. encodePathSegment(userId) .. "/tasks/" .. encodePathSegment(taskId) .. "/grade",
    request
  )
end

function CivicTechForSchoolsService:CompleteMilestone(playerOrUserId: Player | string | number, taskId: string, milestoneId: string)
  local userId = normalizeUserId(playerOrUserId)

  return self:_request(
    "PUT",
    "/experiences/me/players/" .. encodePathSegment(userId) .. "/tasks/" .. encodePathSegment(taskId) .. "/milestones/" .. encodePathSegment(milestoneId) .. "/completion"
  )
end

function CivicTechForSchoolsService:PushTasksToPlayer(player: Player)
  local tasks, err = self:ListTasksForPlayer(player)
  if err then
    self.Client.TaskAssignmentsUpdated:Fire(player, {
      success = false,
      error = err,
    })
    return nil, err
  end

  self.Client.TaskAssignmentsUpdated:Fire(player, {
    success = true,
    payload = tasks,
  })

  return tasks, nil
end

function CivicTechForSchoolsService:KnitInit()
  local configModule = require(self.Modules.Config.CivicTechForSchools)
  local config = configModule :: Config

  self.BaseUrl = config.BaseUrl
  self.ApiKey = config.ApiKey
  self.ExperienceProfile = config.ExperienceProfile
  self.EnableDebugLogging = config.EnableDebugLogging == true
end

function CivicTechForSchoolsService:KnitStart()
  self:PutExperience()

  local function pushFor(player: Player)
    self:PushTasksToPlayer(player)
  end

  Players.PlayerAdded:Connect(pushFor)
  for _, player in ipairs(Players:GetPlayers()) do
    pushFor(player)
  end
end

return CivicTechForSchoolsService
