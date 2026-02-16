--!strict
-- CivicTechForSchoolsService.vanilla.lua
-- Starter scaffold for server-side Roblox integrations.

local HttpService = game:GetService("HttpService")

local CivicTechForSchoolsService = {}
CivicTechForSchoolsService.__index = CivicTechForSchoolsService

export type AssetId = string
export type AssetIds = { AssetId }

export type Milestone = {
  id: string,
  name: string,
  percentageContribution: number,
  assetIds: AssetIds?,
}

export type ExperienceProfile = {
  experienceName: string,
  robloxGameId: string,
  assetIds: AssetIds?,
}

export type CatalogTaskRequest = {
  name: string,
  subheading: string,
  instructions: string,
  assetIds: AssetIds?,
  milestones: { Milestone }?,
}

export type GradeTaskRequest = {
  percentage: number,
}

export type Config = {
  BaseUrl: string,
  ApiKey: string,
  EnableDebugLogging: boolean?,
  RequestTimeoutSeconds: number?,
}

local function validateConfig(config: Config)
  assert(type(config.BaseUrl) == "string" and config.BaseUrl ~= "", "BaseUrl is required")
  assert(type(config.ApiKey) == "string" and config.ApiKey ~= "", "ApiKey is required")
end

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

function CivicTechForSchoolsService.new(config: Config)
  validateConfig(config)

  local self = setmetatable({}, CivicTechForSchoolsService)
  self.BaseUrl = config.BaseUrl
  self.ApiKey = config.ApiKey
  self.EnableDebugLogging = config.EnableDebugLogging == true
  self.RequestTimeoutSeconds = config.RequestTimeoutSeconds or 10

  return self
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
    return nil, {
      message = "RequestAsync failed",
      details = tostring(response),
    }
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

  local decodeOk, decoded = pcall(function()
    return HttpService:JSONDecode(response.Body)
  end)

  if not decodeOk then
    return nil, {
      message = "Invalid JSON response",
      rawBody = response.Body,
    }
  end

  return decoded, nil
end

function CivicTechForSchoolsService:PutExperience(profile: ExperienceProfile)
  return self:_request("PUT", "/experiences/me", profile)
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

return CivicTechForSchoolsService
