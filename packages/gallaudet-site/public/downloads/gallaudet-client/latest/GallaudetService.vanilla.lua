--!strict
-- GallaudetService.vanilla.lua
-- Starter scaffold for server-side Roblox integrations.

local HttpService = game:GetService("HttpService")

local GallaudetService = {}
GallaudetService.__index = GallaudetService

export type PartnerProfile = {
  partnerName: string,
  robloxGameId: string,
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

function GallaudetService.new(config: Config)
  validateConfig(config)

  local self = setmetatable({}, GallaudetService)
  self.BaseUrl = config.BaseUrl
  self.ApiKey = config.ApiKey
  self.EnableDebugLogging = config.EnableDebugLogging == true
  self.RequestTimeoutSeconds = config.RequestTimeoutSeconds or 10

  return self
end

function GallaudetService:_log(...)
  if self.EnableDebugLogging then
    print("[GallaudetService]", ...)
  end
end

function GallaudetService:_request(method: string, path: string, body: any?)
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

function GallaudetService:PutPartner(profile: PartnerProfile)
  return self:_request("PUT", "/partners/me", profile)
end

function GallaudetService:CatalogTask(entryId: string, request: {
  name: string,
  subheading: string,
  instructions: string,
  milestones: { {
    id: string,
    name: string,
    percentageContribution: number,
  } }?,
})
  return self:_request("PUT", "/task-catalog/" .. entryId, request)
end

function GallaudetService:ListTasksForPlayer(robloxUserId: string)
  return self:_request("GET", "/partners/me/players/" .. robloxUserId .. "/tasks")
end

function GallaudetService:GradeTask(robloxUserId: string, taskId: string, percentage: number)
  return self:_request(
    "PUT",
    "/partners/me/players/" .. robloxUserId .. "/tasks/" .. taskId .. "/grade",
    { percentage = percentage }
  )
end

function GallaudetService:CompleteMilestone(robloxUserId: string, taskId: string, milestoneId: string)
  return self:_request(
    "PUT",
    "/partners/me/players/" .. robloxUserId .. "/tasks/" .. taskId .. "/milestones/" .. milestoneId .. "/completion"
  )
end

return GallaudetService
