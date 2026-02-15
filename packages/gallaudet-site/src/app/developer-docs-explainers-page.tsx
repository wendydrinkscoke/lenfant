import { Link } from "react-router-dom"
import { Clock3, Users } from "lucide-react"
import { experienceExplainers } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

export default function DeveloperDocsExplainersPage() {
  return (
    <PartnerDocsShell
      badge="Explainers"
      title="Concept explainers"
      description="Longer-form guidance on architecture choices and product-design tradeoffs for experience teams."
    >
      <Card>
        <CardHeader>
          <CardTitle>Explainer library</CardTitle>
          <CardDescription>
            These pages are intended for deeper context beyond endpoint-by-endpoint reference docs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {experienceExplainers.map((explainer) => (
            <Link
              key={explainer.slug}
              to={`/create/docs/explainers/${explainer.slug}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <p className="text-lg font-semibold">{explainer.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{explainer.summary}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {explainer.estimatedRead}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {explainer.audience}
                </span>
                <span>Updated: {explainer.updatedOn}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </PartnerDocsShell>
  )
}
