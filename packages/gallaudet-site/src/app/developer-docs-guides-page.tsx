import { Link } from "react-router-dom"
import { Clock3, Route } from "lucide-react"
import { experienceGuides } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

export default function DeveloperDocsGuidesPage() {
  return (
    <PartnerDocsShell
      badge="Guides"
      title="Partner integration guides"
      description="Hands-on walkthroughs for integrating CivicTech for Schools into Roblox experiences."
    >
      <Card>
        <CardHeader>
          <CardTitle>Guide collection</CardTitle>
          <CardDescription>
            Tutorial-style docs for common experience integration patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {experienceGuides.map((guide) => (
            <Link
              key={guide.slug}
              to={`/create/docs/guides/${guide.slug}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <p className="text-lg font-semibold">{guide.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{guide.summary}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {guide.estimatedRead}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Route className="h-3 w-3" />
                  {guide.audience}
                </span>
                <span>Updated: {guide.updatedOn}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </PartnerDocsShell>
  )
}
