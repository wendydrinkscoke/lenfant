import { Link } from "react-router-dom"
import { ArrowRight, BookOpen, Download, FileCode2, GraduationCap, Lightbulb } from "lucide-react"
import { partnerClientDownloads, partnerExplainers, partnerGuides } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

const sections = [
  {
    title: "API reference",
    description: "Partner-facing runtime and onboarding endpoints with request and response details.",
    icon: FileCode2,
    to: "/create/docs/api",
  },
  {
    title: "Guides",
    description: "Step-by-step integration walkthroughs for vanilla Lua and Knit/Fusion architectures.",
    icon: GraduationCap,
    to: "/create/docs/guides",
  },
  {
    title: "Explainers",
    description: "Deep dives on design choices like milestone-based progress and auth model boundaries.",
    icon: Lightbulb,
    to: "/create/docs/explainers",
  },
  {
    title: "Downloads",
    description: "Starter client files and integration templates for your Roblox experience.",
    icon: Download,
    to: "/create/docs/downloads",
  },
]

export default function DeveloperDocsHomePage() {
  return (
    <PartnerDocsShell
      title="Partner integration docs for Gallaudet"
      description="This docs portal focuses only on partner-relevant APIs and implementation patterns for Roblox game teams integrating with CivicTech for Schools."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            What this docs surface includes
          </CardTitle>
          <CardDescription>
            Structured to support both API references and tutorial-style partner content.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.title}
              to={section.to}
              className="group rounded-lg border p-4 transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center justify-between">
                <section.icon className="h-5 w-5 text-emerald-600" />
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 font-medium">{section.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fastest path to a working integration</CardTitle>
          <CardDescription>
            Suggested sequence if you are integrating a new partner game.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-md border p-3">
            <p className="font-medium text-foreground">1. Provision partner key and secret</p>
            <p className="mt-1">Create a project, delegate secret-store access, and vend a runtime key into Roblox Secret Store.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium text-foreground">2. Register your game metadata</p>
            <p className="mt-1">Call <code>PUT /partners/me</code> once at startup to bind API key to experience metadata.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium text-foreground">3. Catalog assignable tasks</p>
            <p className="mt-1">Call <code>PUT /task-catalog/&#123;entryId&#125;</code> for each teacher-assignable task template.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium text-foreground">4. Sync player assignments and report progress</p>
            <p className="mt-1">Fetch task instances on join, then send <code>GradeTask</code> or <code>CompleteMilestone</code> updates from server gameplay events.</p>
          </div>
          <div className="pt-2">
            <Button asChild>
              <Link to="/create/docs/api">Open API reference</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Guide library</CardTitle>
            <CardDescription>How-to tutorials for common integration paths.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {partnerGuides.map((guide) => (
              <Link key={guide.slug} to={`/create/docs/guides/${guide.slug}`} className="block rounded-md border p-3 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{guide.title}</p>
                  <Badge variant={guide.status === "ready" ? "outline" : "secondary"}>
                    {guide.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{guide.summary}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Explainers</CardTitle>
            <CardDescription>Conceptual references for architecture and gameplay tradeoffs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {partnerExplainers.map((explainer) => (
              <Link key={explainer.slug} to={`/create/docs/explainers/${explainer.slug}`} className="block rounded-md border p-3 hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{explainer.title}</p>
                  <Badge variant={explainer.status === "ready" ? "outline" : "secondary"}>
                    {explainer.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{explainer.summary}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest client downloads</CardTitle>
          <CardDescription>
            Starter client files for quick integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {partnerClientDownloads.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </div>
              <Button asChild variant="outline">
                <a href={item.href} download>
                  Download .{item.format}
                </a>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </PartnerDocsShell>
  )
}
