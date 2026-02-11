import { useMemo } from "react"
import { Lock, ServerCog, UserRoundCog } from "lucide-react"
import { experienceApiResources } from "../content/partner-docs"
import { PartnerDocsCodeBlock } from "../components/partner-docs/partner-docs-code-block"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { cn } from "../lib/utils"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

const methodClassMap = {
  GET: "bg-sky-100 text-sky-700",
  POST: "bg-violet-100 text-violet-700",
  PUT: "bg-emerald-100 text-emerald-700",
} as const

export default function DeveloperDocsApiPage() {
  const runtimeApis = useMemo(
    () => experienceApiResources.filter((item) => item.category === "runtime"),
    []
  )

  const onboardingApis = useMemo(
    () => experienceApiResources.filter((item) => item.category === "onboarding"),
    []
  )

  return (
    <PartnerDocsShell
      badge="API Reference"
      title="Partner-facing API reference"
      description="Core runtime APIs for Roblox servers plus onboarding APIs used by the developer portal."
    >
      <Card>
        <CardHeader>
          <CardTitle>Authentication modes</CardTitle>
          <CardDescription>
            Different API groups use different auth because runtime traffic and onboarding traffic have different trust boundaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4 text-emerald-600" />
              Runtime calls: x-api-key
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this for calls from Roblox game servers: experience profile, task catalog, task fetches, and grading updates.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="flex items-center gap-2 font-medium">
              <UserRoundCog className="h-4 w-4 text-emerald-600" />
              Onboarding calls: Cognito session
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Used by the experience portal for project creation and secret delegation/vending flows.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4" id="runtime-apis">
        <h2 className="text-xl font-semibold">Runtime APIs (Roblox server-side)</h2>
        <p className="text-sm text-muted-foreground">
          These endpoints are intended for in-game server scripts and should never be called directly from clients.
        </p>

        <div className="space-y-4">
          {runtimeApis.map((resource) => (
            <Card key={resource.id} id={resource.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border-0", methodClassMap[resource.method])}>
                    {resource.method}
                  </Badge>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">{resource.path}</code>
                </div>
                <CardTitle className="text-lg">{resource.title}</CardTitle>
                <CardDescription>{resource.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="font-medium text-foreground">Why it matters</p>
                  <p className="mt-1 text-muted-foreground">{resource.whyUseful}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Authentication</p>
                    <p className="rounded-md border p-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{resource.auth.label}</span>
                      <br />
                      {resource.auth.details}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Common errors</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {resource.commonErrors.map((errorLine) => (
                        <li key={errorLine} className="rounded-md border px-3 py-2">
                          {errorLine}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Inputs</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {resource.requestFields.map((field) => (
                        <li key={field} className="rounded-md border px-3 py-2">
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Outputs</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {resource.responseFields.map((field) => (
                        <li key={field} className="rounded-md border px-3 py-2">
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {resource.examples.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Examples</p>
                    {resource.examples.map((example) => (
                      <PartnerDocsCodeBlock
                        key={`${resource.id}-${example.title}`}
                        title={example.title}
                        language={example.language}
                        code={example.code}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" id="onboarding-apis">
        <h2 className="text-xl font-semibold">Onboarding APIs (developer portal)</h2>
        <p className="text-sm text-muted-foreground">
          These endpoints are part of project onboarding and secret management flows in `/create`.
        </p>

        <div className="space-y-4">
          {onboardingApis.map((resource) => (
            <Card key={resource.id} id={resource.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border-0", methodClassMap[resource.method])}>
                    {resource.method}
                  </Badge>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs">{resource.path}</code>
                  <Badge variant="outline" className="ml-auto">
                    <ServerCog className="mr-1 h-3 w-3" />
                    Portal flow
                  </Badge>
                </div>
                <CardTitle className="text-lg">{resource.title}</CardTitle>
                <CardDescription>{resource.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{resource.whyUseful}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold">Inputs</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {resource.requestFields.map((field) => (
                        <li key={field} className="rounded-md border px-3 py-2">
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">Outputs</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {resource.responseFields.map((field) => (
                        <li key={field} className="rounded-md border px-3 py-2">
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PartnerDocsShell>
  )
}
