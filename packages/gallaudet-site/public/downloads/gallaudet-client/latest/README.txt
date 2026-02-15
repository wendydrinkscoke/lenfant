Gallaudet Client Starter Pack (latest)
Updated: 2026-02-15

This directory contains starter Roblox Lua files used by the experience docs page.

Files:
- GallaudetService.vanilla.lua
  Use this if your game architecture is based on plain ModuleScripts + RemoteEvents/RemoteFunctions.

- GallaudetService.knit.lua
  Use this if your game uses Knit services/controllers.

Bootstrapping secrets and API keys:
1) In https://gamma.school.civictech.llc/create/, add your universe as a project and open the Secrets panel.
2) In https://create.roblox.com/dashboard/credentials, create a Roblox Open Cloud API key for that universe with:
   - secret-store:write
   - secret-store:read
3) Back in /create/ Secrets Step 1, paste the key and click "Save API key".
4) Only after Step 3 succeeds, click "Create secret" in Step 2.
5) Copy the returned secret ID and verify it in:
   https://create.roblox.com/dashboard/creations/experiences/${yourExperienceId}/secrets

Use the secret in your config module (Knit example):
```lua
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")

type ExperienceProfile = {
  experienceName: string,
  robloxGameId: string,
}

local GallaudetSecret = HttpService:GetSecret("rdvdhfzvfahk")

local Config = {
  BaseUrl = "https://api.beta.school.civictech.llc",
  RequestTimeoutSeconds = 10,
  ApiKey = GallaudetSecret,
  ExperienceProfile = {
    experienceName = "Run the World - Learn Country Names!",
    robloxGameId = "127120714583972",
  } :: ExperienceProfile,
  EnableDebugLogging = RunService:IsStudio(),
}

return Config
```

Use the secret in vanilla service construction:
```lua
local HttpService = game:GetService("HttpService")
local GallaudetService = require(path.to.GallaudetService)

local service = GallaudetService.new({
  BaseUrl = "https://api.beta.school.civictech.llc",
  ApiKey = HttpService:GetSecret("rdvdhfzvfahk"),
  EnableDebugLogging = true,
})
```

Notes:
- Replace rdvdhfzvfahk with the secret ID returned by "Create secret".
- Do not hardcode raw API keys in scripts.
- Runtime requests should be made from server scripts only.
- These files are scaffolds; adapt error handling, logging, retry, and timeouts for your game.
