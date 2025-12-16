import { useEffect, useState } from "react"
import { buildRobloxAuthorizeUrl } from "../lib/roblox-oauth"

export default function RobloxOAuthStart() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href)
        const scopesParam = url.searchParams.get("scopes")
        const scopes = scopesParam ? scopesParam.split(",").filter(Boolean) : []
        if (!scopes.length) {
          throw new Error("No Roblox scopes provided")
        }

        const authorizeUrl = await buildRobloxAuthorizeUrl(scopes)
        window.location.replace(authorizeUrl)
      } catch (e: any) {
        console.error(e)
        setError(e?.message ?? "Failed to start Roblox OAuth")
      }
    })()
  }, [])

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <p>Redirecting to Roblox…</p>}
    </div>
  )
}
