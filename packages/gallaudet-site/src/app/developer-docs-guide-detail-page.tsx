import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CalendarClock, Clock3, Route } from "lucide-react"
import { getGuideBySlug, getPartnerApiById } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

export default function DeveloperDocsGuideDetailPage() {
  const { slug } = useParams()
  const guide = slug ? getGuideBySlug(slug) : undefined

  if (!guide) {
    return (
      <PartnerDocsShell
        badge="Guides"
        title="Guide not found"
        description="The requested guide does not exist yet."
      >
        <Card>
          <CardHeader>
            <CardTitle>Missing guide</CardTitle>
            <CardDescription>
              The guide URL is unavailable. Browse the guide list for available walkthroughs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/create/docs/guides">Back to guides</Link>
            </Button>
          </CardContent>
        </Card>
      </PartnerDocsShell>
    )
  }

  return (
    <PartnerDocsShell
      badge="Guide"
      title={guide.title}
      description={guide.summary}
    >
      <Button asChild variant="ghost" className="w-fit">
        <Link to="/create/docs/guides">
          <ArrowLeft className="h-4 w-4" />
          Back to guides
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Guide metadata</CardTitle>
          <CardDescription>
            Read time, intended audience, and last update.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <Clock3 className="h-4 w-4 text-emerald-600" />
            {guide.estimatedRead}
          </p>
          <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <Route className="h-4 w-4 text-emerald-600" />
            {guide.audience}
          </p>
          <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <CalendarClock className="h-4 w-4 text-emerald-600" />
            Updated {guide.updatedOn}
          </p>
          <p className="md:col-span-3">
            <Badge variant={guide.status === "ready" ? "outline" : "secondary"}>{guide.status}</Badge>
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {guide.sections.map((section) => (
          <Card key={section.heading}>
            <CardHeader>
              <CardTitle>{section.heading}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Related API endpoints</CardTitle>
          <CardDescription>
            Jump directly into reference details for endpoints used in this guide.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {guide.relatedApiIds.map((apiId) => {
            const api = getPartnerApiById(apiId)
            if (!api) {
              return null
            }
            return (
              <Button key={apiId} asChild variant="outline" size="sm">
                <Link to={`/create/docs/api#${api.id}`}>
                  <code>{api.method}</code>
                  {api.path}
                </Link>
              </Button>
            )
          })}
        </CardContent>
      </Card>
    </PartnerDocsShell>
  )
}
