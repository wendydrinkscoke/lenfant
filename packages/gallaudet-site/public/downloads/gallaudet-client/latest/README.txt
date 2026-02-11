Gallaudet Client Starter Pack (latest)
Updated: 2026-02-10

This directory contains starter Roblox Lua files used by the experience docs page.

Files:
- GallaudetService.vanilla.lua
  Use this if your game architecture is based on plain ModuleScripts + RemoteEvents/RemoteFunctions.

- GallaudetService.knit.lua
  Use this if your game uses Knit services/controllers.

Notes:
- Keep your experience API key in Roblox Secret Store and load it with HttpService:GetSecret().
- Runtime requests should be made from server scripts only.
- These files are scaffolds and should be adapted to your game's error handling, logging, and retry policies.
