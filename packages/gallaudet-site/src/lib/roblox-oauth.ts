import { generateCodeChallenge, generateCodeVerifier } from "./pkce-utils"
import { getRobloxOAuthClientId } from "./environment-utils"

const stateToB64Url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
const stateFromB64Url = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4)
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)
}

export async function buildRobloxAuthorizeUrl(scopes: string[]) {
  if (!scopes.length) {
    throw new Error("At least one Roblox scope is required")
  }
  const clientId = getRobloxOAuthClientId()
  const authorizeBase = "https://apis.roblox.com/oauth/v1/authorize"
  const redirectUri = `${window.location.origin}/roblox/oauth-callback`

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  localStorage.setItem("roblox_pkce_verifier", verifier)

  const stateObj = { scopes }
  const state = stateToB64Url(JSON.stringify(stateObj))

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  })

  return `${authorizeBase}?${params.toString()}`
}

export async function exchangeRobloxCodeForVerifier(code: string) {
  const verifier = localStorage.getItem("roblox_pkce_verifier")
  const redirectUri = `${window.location.origin}/roblox/oauth-callback`
  return { code, codeVerifier: verifier, redirectUri }
}

export function parseRobloxState(rawState: string | null): { scopes: string[] } {
  if (!rawState) return { scopes: [] }
  try {
    const parsed = JSON.parse(stateFromB64Url(rawState))
    const scopes = Array.isArray(parsed.scopes) ? parsed.scopes.filter(Boolean) : []
    return { scopes }
  } catch {
    return { scopes: [] }
  }
}
