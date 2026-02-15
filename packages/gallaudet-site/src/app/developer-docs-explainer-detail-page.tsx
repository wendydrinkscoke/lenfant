import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CalendarClock, Clock3, Users } from "lucide-react"
import { getExplainerBySlug, getPartnerApiById } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { PartnerDocsTypographyBody } from "../components/partner-docs/partner-docs-typography"
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

      <article className="mx-auto w-full max-w-4xl space-y-12">
        <section className="space-y-6 border-b pb-8">
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
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
          </div>
        </section>

        <div className="space-y-12">
          {explainer.sections.map((section) => (
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
            Reference endpoints mentioned in this explainer.
          </p>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </section>
      </article>
    </PartnerDocsShell>
  )
}
