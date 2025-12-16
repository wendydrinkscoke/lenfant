import { useEffect, useState } from "react"
import { Gauge, HandHeart, KeyRound, Megaphone, ShieldCheck, Sparkles, TerminalSquare } from "lucide-react"
import { startCognitoOAuthFlowViaPopup } from "../lib/auth-utils"
import { getGallaudetApi } from "../lib/gallaudet-api"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { toast } from "sonner"

const sellingPoints = [
  {
    title: "Free to onboard",
    desc: "Join the marketplace at no cost. There are no upfront fees. We make it easy to get started and grow.",
    icon: Sparkles,
  },
  {
    title: "Reach more players",
    desc: "Be featured inside our marketplace of educational Roblox games. It's free, targeted distribution to engaged students.",
    icon: Megaphone,
  },
  {
    title: "Self-service, secure setup",
    desc: "Own the experience? Link Google + Roblox once. We create and rotate secrets automatically—no custom auth code needed.",
    icon: ShieldCheck,
  },
  {
    title: "Lua examples for every style",
    desc: "Whether your game is coded using Knit-based services or with vanilla remote functions and events, we have drop-in code snippets to jumpstart your integration effort.",
    icon: TerminalSquare,
  },
  {
    title: "High-touch support",
    desc: "CivicTech for Schools engineers prioritize partner success. Expect fast help by email and guided integrations.",
    icon: HandHeart,
  },
  {
    title: "Insights dashboards",
    desc: "Track classroom adoption, API health, and student progress with curated dashboards built for game owners.",
    icon: Gauge,
  },
]

export default function DeveloperOnboardingContent() {
  const [googleSignedIn, setGoogleSignedIn] = useState(false)
  const [robloxLinked, setRobloxLinked] = useState(false)
  const [robloxScopesNeeded, setRobloxScopesNeeded] = useState<string[]>([])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!event.data || typeof event.data !== "object") return
      const { type, scopes, code, codeVerifier, redirectUri } = event.data as {
        type?: string
        scopes?: string[]
        code?: string
        codeVerifier?: string | null
        redirectUri?: string
      }
      if (type === "google-signin-complete") {
        setGoogleSignedIn(true)
        toast.success("Google sign-in complete")
      }
      if (type === "roblox-sign-in-complete") {
        setRobloxLinked(true)
        toast.success("Roblox sign-in complete")
      }
      if (type === "roblox-scopes-required" && Array.isArray(scopes)) {
        setRobloxScopesNeeded(scopes)
        toast.message("Roblox scopes needed", { description: scopes.join(", ") })
        const params = new URLSearchParams({ scopes: scopes.join(",") })
        const popup = window.open(
          `${window.location.origin}/roblox/oauth-start?${params.toString()}`,
          "robloxOAuth",
          "width=520,height=640"
        )
        if (!popup) {
          toast.error("Please allow popups to approve Roblox scopes.")
        }
      }
      if (type === "roblox-oauth-complete" && code) {
        setRobloxScopesNeeded([])
        toast.success("Roblox scopes approved");
        (async () => {
          try {
            const apiClient = await getGallaudetApi()
            await apiClient.delegateRobloxSecretStoreAccess({
              delegateRobloxSecretStoreAccessRequestContent: {
                code,
                code_verifier: codeVerifier ?? "",
                redirect_uri: redirectUri ?? `${window.location.origin}/roblox/oauth-callback`,
              },
            })
            toast.success("Roblox secret-store delegation saved")
          } catch (err: any) {
            console.error("[Roblox OAuth] backend delegation failed", err)
            toast.error("Failed to save Roblox delegation", {
              description: err?.message ?? "Try again or contact support.",
            })
          }
        })()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  const handleStartOnboarding = () => {
    const popup = startCognitoOAuthFlowViaPopup({
      roleOverride: "developer",
      includeRobloxAssociation: true,
      robloxScopes: ["universe.secret:write", "universe.secret:read"],
    })
    if (!popup) {
      toast.error("Please allow popups to continue onboarding.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/30" />
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              {"Bring your Roblox experience to students everywhere—fast, free, and well-supported."}
            </h1>
            <p className="text-lg text-muted-foreground">
              {
                "We make it effortless for developers of educational Roblox games to reach teachers and students. Onboard in minutes, let us manage secrets and security, and get the code + dashboards you need to launch confidently."
              }
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleStartOnboarding}>{"Start self-service onboarding"}</Button>
              <Button asChild variant="outline">
                <a href="mailto:cupwendyscup@gmail.com">{"Talk to our team"}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16 space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          {sellingPoints.map((point) => (
            <Card key={point.title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <point.icon className="h-5 w-5 text-emerald-600" />
                  {point.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{point.desc}</CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50 shadow-sm dark:from-emerald-950/30 dark:to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              {"How the self-service flow works"}
            </CardTitle>
            <CardDescription>
              {
                "Sign in with Google + Roblox (via Cognito), then approve Roblox secret scopes. We rotate the secrets; you just drop the Lua code in."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              <Badge variant={googleSignedIn ? "secondary" : "outline"}>
                {googleSignedIn ? "Google linked" : "Google pending"}
              </Badge>
              <Badge variant={robloxLinked ? "secondary" : "outline"}>
                {robloxLinked ? "Roblox linked" : "Roblox pending"}
              </Badge>
              <Badge variant={robloxScopesNeeded.length ? "secondary" : "outline"}>
                {robloxScopesNeeded.length ? "Roblox scopes pending" : "Scopes requested on link"}
              </Badge>
            </div>
            <p>{"Requested Roblox scopes: universe.secret:write, universe.secret:read."}</p>
            {robloxScopesNeeded.length ? (
              <p className="text-xs text-muted-foreground">
                {"After signing in, approve these scopes in the Roblox prompt so we can create and rotate secrets for your universe."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {"When the popup appears, approve the Roblox scopes so we can securely manage secrets your game can read."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandHeart className="h-5 w-5 text-emerald-600" />
              {"You're supported the whole way"}
            </CardTitle>
            <CardDescription>
              {"We prioritize onboarding new developers—expect real humans, quick replies, and dashboards you can act on."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="space-y-1">
              <p>{"Need help or want a walkthrough? Email cupwendyscup@gmail.com and we'll get back quickly."}</p>
            </div>
            <Button asChild>
              <a href="mailto:cupwendyscup@gmail.com">{"Email the team"}</a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
