import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

export function MetricsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Metrics</p>
        <p className="text-sm text-muted-foreground">Track usage, latency, and student engagement trends.</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Insights for assignments completed, active students, and API performance.
        </CardContent>
      </Card>
    </div>
  )
}
