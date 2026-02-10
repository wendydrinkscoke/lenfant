import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CalendarClock, Clock3, Users } from "lucide-react"
import { getExplainerBySlug, getPartnerApiById } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

export default function DeveloperDocsExplainerDetailPage() {
  const { slug } = useParams()
  const explainer = slug ? getExplainerBySlug(slug) : undefined

  if (!explainer) {
    return (
      <PartnerDocsShell
        badge="Explainers"
        title="Explainer not found"
        description="The requested explainer does not exist yet."
      >
        <Card>
          <CardHeader>
            <CardTitle>Missing explainer</CardTitle>
            <CardDescription>
              The explainer URL is unavailable. Browse the explainer list for available topics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/create/docs/explainers">Back to explainers</Link>
            </Button>
          </CardContent>
        </Card>
      </PartnerDocsShell>
    )
  }

  return (
    <PartnerDocsShell
      badge="Explainer"
      title={explainer.title}
      description={explainer.summary}
    >
      <Button asChild variant="ghost" className="w-fit">
        <Link to="/create/docs/explainers">
          <ArrowLeft className="h-4 w-4" />
          Back to explainers
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Explainer metadata</CardTitle>
          <CardDescription>
            Read time, intended audience, and last update.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <Clock3 className="h-4 w-4 text-emerald-600" />
            {explainer.estimatedRead}
          </p>
          <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <Users className="h-4 w-4 text-emerald-600" />
            {explainer.audience}
          </p>
          <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <CalendarClock className="h-4 w-4 text-emerald-600" />
            Updated {explainer.updatedOn}
          </p>
          <p className="md:col-span-3">
            <Badge variant={explainer.status === "ready" ? "outline" : "secondary"}>{explainer.status}</Badge>
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {explainer.sections.map((section) => (
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
            Reference endpoints mentioned in this explainer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {explainer.relatedApiIds.map((apiId) => {
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
