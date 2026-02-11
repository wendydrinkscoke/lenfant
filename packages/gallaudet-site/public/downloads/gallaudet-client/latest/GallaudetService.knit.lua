--!strict
-- GallaudetService.knit.lua
-- Starter scaffold for Knit-based Roblox games.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local Knit = require(ReplicatedStorage.Packages.Knit)

local GallaudetService = Knit.CreateService({
  Name = "GallaudetService",
  Client = {
    TaskAssignmentsUpdated = Knit.CreateSignal(),
  },
})

type ExperienceProfile = {
  experienceName: string,
  robloxGameId: string,
}

type Config = {
  BaseUrl: string,
  ApiKey: string,
  ExperienceProfile: ExperienceProfile,
  EnableDebugLogging: boolean?,
}

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

function GallaudetService:PutExperience(profile: ExperienceProfile?)
  local payload = profile or self.ExperienceProfile
  return self:_request("PUT", "/experiences/me", payload)
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

function GallaudetService:ListTasksForPlayer(playerOrUserId: Player | string | number)
  local userId: string
  if typeof(playerOrUserId) == "Instance" then
    userId = tostring((playerOrUserId :: Player).UserId)
  else
    userId = tostring(playerOrUserId)
  end

  return self:_request("GET", "/experiences/me/players/" .. userId .. "/tasks")
end

function GallaudetService:GradeTask(playerOrUserId: Player | string | number, taskId: string, percentage: number)
  local userId = typeof(playerOrUserId) == "Instance"
    and tostring((playerOrUserId :: Player).UserId)
    or tostring(playerOrUserId)

  return self:_request(
    "PUT",
    "/experiences/me/players/" .. userId .. "/tasks/" .. taskId .. "/grade",
    { percentage = percentage }
  )
end

function GallaudetService:CompleteMilestone(playerOrUserId: Player | string | number, taskId: string, milestoneId: string)
  local userId = typeof(playerOrUserId) == "Instance"
    and tostring((playerOrUserId :: Player).UserId)
    or tostring(playerOrUserId)

  return self:_request(
    "PUT",
    "/experiences/me/players/" .. userId .. "/tasks/" .. taskId .. "/milestones/" .. milestoneId .. "/completion"
  )
end

function GallaudetService:PushTasksToPlayer(player: Player)
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

function GallaudetService:KnitInit()
  local configModule = require(self.Modules.Config.Gallaudet)
  local config = configModule :: Config

  self.BaseUrl = config.BaseUrl
  self.ApiKey = config.ApiKey
  self.ExperienceProfile = config.ExperienceProfile
  self.EnableDebugLogging = config.EnableDebugLogging == true
end

function GallaudetService:KnitStart()
  self:PutExperience()

  local function pushFor(player: Player)
    self:PushTasksToPlayer(player)
  end

  Players.PlayerAdded:Connect(pushFor)
  for _, player in ipairs(Players:GetPlayers()) do
    pushFor(player)
  end
end

return GallaudetService
