import { useEffect, useState } from "react"
import { exchangeRobloxCodeForVerifier, parseRobloxState } from "../lib/roblox-oauth"

export default function RobloxOAuthCallback() {
  const [message, setMessage] = useState("Finishing Roblox OAuth…")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        if (!code) {
          throw new Error("Missing Roblox code")
        }
        const { scopes } = parseRobloxState(url.searchParams.get("state"))
        const { codeVerifier, redirectUri } = await exchangeRobloxCodeForVerifier(code)

        const payload = { type: "roblox-oauth-complete", code, codeVerifier, scopes, redirectUri }
        console.log("[Roblox OAuth] code received", payload)

        if (window.opener && window.opener !== window) {
          window.opener.postMessage(payload, window.location.origin)
          window.close()
          return
        }

        setMessage(`Code: ${code}\nVerifier: ${codeVerifier ?? "(missing)"}\nScopes: ${scopes.join(", ")}`)
      } catch (e: any) {
        console.error(e)
        setError(e?.message ?? "Roblox OAuth error")
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { type: "roblox-oauth-complete", ok: false, error: String(e) },
            window.location.origin
          )
          window.close()
        }
      }
    })()
  }, [])

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: "1rem", whiteSpace: "pre-wrap" }}>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <p>{message}</p>}
    </div>
  )
}
