import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

export function AssetManagerPanel() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Asset Manager</p>
        <p className="text-sm text-muted-foreground">Organize thumbnails, badges, and media for your listing.</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Upload, version, and manage branded assets from one place.
        </CardContent>
      </Card>
    </div>
  )
}
