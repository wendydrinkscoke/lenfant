import { useState, useCallback } from "react"
// If you have this util, you can optionally fetch clientId to check `aud`
// import { getRuntimeConfig } from "../lib/environment-utils"

export interface User {
  id: string        // Google sub (from Cognito identities)
  email: string
  name: string
  picture?: string
}

type IdentitiesEntry = {
  userId: string
  providerName?: string
  providerType?: string
  issuer?: string
  primary?: string | boolean
  dateCreated?: string
}

type IdTokenClaims = {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  exp?: number
  iss?: string
  aud?: string
  "cognito:username"?: string
  identities?: IdentitiesEntry[] | string // Cognito sometimes serializes as JSON string
  nonce?: string
  [k: string]: any
}

function safeBase64UrlDecode(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
  // add padding if needed
  const pad = b64.length % 4
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64
  return atob(padded)
}

function parseJwt<T = any>(token: string): T | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = safeBase64UrlDecode(parts[1])
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function coerceIdentities(value: IdTokenClaims["identities"]): IdentitiesEntry[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function extractGoogleSubFromClaims(claims: IdTokenClaims): string | null {
  const identities = coerceIdentities(claims.identities)
  const google =
    identities.find(i => (i.providerName === "Google" || i.providerType === "Google")) ||
    identities.find(i => (i.issuer?.includes("accounts.google.com")))
  return google?.userId ?? null
}

function isExpired(claims: IdTokenClaims): boolean {
  if (!claims?.exp) return true
  const now = Math.floor(Date.now() / 1000)
  return claims.exp <= now
}

export type AuthUser = User;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)

  const isLocalMockAuthEnabled = () => {
    if (typeof window === "undefined") return false
    if (window.location.hostname !== "localhost") return false
    try {
      return window.localStorage.getItem("gallaudet-use-real-auth") !== "true"
    } catch {
      return true
    }
  }

  const clearLocalTokens = () => {
    try {
      window.localStorage.removeItem("id_token")
      window.localStorage.removeItem("access_token")
      window.localStorage.removeItem("refresh_token")
    } catch {}
  }

  const checkAuth = useCallback(async (loginHint?: string | null) => {
    if (isLocalMockAuthEnabled()) {
      const mockUser: User = {
        id: "mock-local-user-dewey-finn",
        email: "deweyfinn@horacegreenprep.com",
        name: "Dewey Finn",
        picture: "https://assets.mycast.io/actor_images/actor-dewey-finn-455157_large.jpg?1655136809",
      }
      setUser(mockUser)
      setIsSignedIn(true)
      return mockUser
    }

    // 1) Read the Cognito tokens placed by your /cognito/callback page
    const idToken = window.localStorage.getItem("id_token")

    if (!idToken) {
      setIsSignedIn(false)
      setUser(null)
      throw new Error("NO_SESSION")
    }

    // 2) Decode and sanity-check the ID token
    const claims = parseJwt<IdTokenClaims>(idToken)
    if (!claims) {
      clearLocalTokens()
      setIsSignedIn(false)
      setUser(null)
      throw new Error("BAD_ID_TOKEN")
    }

    // (Optional) verify audience if you want:
    // const { userPoolWebClientId } = await getRuntimeConfig()
    // if (claims.aud && claims.aud !== userPoolWebClientId) { ... }

    if (isExpired(claims)) {
      clearLocalTokens()
      setIsSignedIn(false)
      setUser(null)
      throw new Error("EXPIRED")
    }

    // 3) Pull Google 'sub' from Cognito's identities[] and compare to login_hint
    const googleSub = extractGoogleSubFromClaims(claims)
    if (loginHint && googleSub && loginHint !== googleSub) {
      // Classroom user != our session user → force re-auth
      clearLocalTokens()
      setIsSignedIn(false)
      setUser(null)
      const err: any = new Error("LOGIN_HINT_MISMATCH")
      ;(err.code as string) = "LOGIN_HINT_MISMATCH"
      throw err
    }

    // 4) Construct the User object from claims
    const displayName =
      claims.name ||
      [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
      claims.email ||
      googleSub ||
      claims["cognito:username"] ||
      "User"

    const u: User = {
      id: googleSub || claims.sub || claims["cognito:username"] || "unknown",
      email: claims.email || "",
      name: displayName,
      picture: claims.picture,
    }

    setUser(u)
    setIsSignedIn(true)
    return u
  }, [])

  const signOut = useCallback(async () => {
    try {
      if (isLocalMockAuthEnabled()) {
        setUser(null)
        setIsSignedIn(false)
        return
      }

      // Optional: tell your backend (if you maintain server session)
      // Ignore errors; we still clear local side.
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => {})

      clearLocalTokens()
      setUser(null)
      setIsSignedIn(false)

      // (Optional) also hit Cognito global logout to clear Hosted UI cookie:
      // const { cognitoDomainPrefix } = await getRuntimeConfig()
      // const logoutUri = encodeURIComponent(window.location.origin + "/")
      // window.location.href = `https://${cognitoDomainPrefix}.auth.us-east-1.amazoncognito.com/logout?client_id=${userPoolWebClientId}&logout_uri=${logoutUri}`
      // If you don’t want the redirect, just reload:
      window.location.reload()
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }, [])

  return {
    user,
    isSignedIn,
    checkAuth,
    signOut,
  }
}
