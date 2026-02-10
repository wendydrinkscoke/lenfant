import { Download, FileArchive, Package, Wrench } from "lucide-react"
import { partnerClientDownloads } from "../content/partner-docs"
import { PartnerDocsShell } from "../components/partner-docs/partner-docs-shell"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

export default function DeveloperDocsDownloadsPage() {
  return (
    <PartnerDocsShell
      badge="Downloads"
      title="Client downloads"
      description="Client files and package resources for partner integrations."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            Latest partner client artifacts
          </CardTitle>
          <CardDescription>
            Download the latest starter clients for vanilla Lua and Knit-based Roblox architectures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {partnerClientDownloads.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <Button asChild variant="outline">
                  <a href={item.href} download>
                    <Download className="h-4 w-4" />
                    Download .{item.format}
                  </a>
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Audience: {item.audience}</span>
                <span>Updated: {item.updatedOn}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-emerald-600" />
              Versioning guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Start with <code>latest</code> for quick setup, then pin to a versioned artifact path for stable production releases.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileArchive className="h-4 w-4 text-emerald-600" />
              Source model linkage
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            API contracts are defined in Smithy, and generated API documentation is available in the Gallaudet API model outputs.
          </CardContent>
        </Card>
      </div>
    </PartnerDocsShell>
  )
}
