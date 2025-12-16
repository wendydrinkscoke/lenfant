import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

export function RolesPanel() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Roles</p>
        <p className="text-sm text-muted-foreground">Invite collaborators and manage experience permissions.</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Assign admin, editor, and viewer roles for your studio team.
        </CardContent>
      </Card>
    </div>
  )
}
