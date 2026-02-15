import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CalendarClock, Clock3, Route } from "lucide-react"
import { getGuideBySlug, getPartnerApiById } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { PartnerDocsTypographyBody } from "../components/partner-docs/partner-docs-typography"
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

      <article className="mx-auto w-full max-w-4xl space-y-12">
        <section className="space-y-6 border-b pb-8">
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
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
          </div>
        </section>

        <div className="space-y-12">
          {guide.sections.map((section) => (
            <section key={section.heading} className="space-y-5">
              <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
                {section.heading}
              </h2>
              <PartnerDocsTypographyBody body={section.body} />
            </section>
          ))}
        </div>

        <section className="space-y-4 border-t pt-8">
          <h2 className="scroll-m-20 text-2xl font-semibold tracking-tight">
            Related API endpoints
          </h2>
          <p className="text-muted-foreground text-sm">
            Jump directly into reference details for endpoints used in this guide.
          </p>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </section>
      </article>
    </PartnerDocsShell>
  )
}
