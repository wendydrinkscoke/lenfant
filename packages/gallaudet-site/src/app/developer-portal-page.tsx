import { DeveloperPortalContent } from "../components/developer-portal-content"
import { CognitoAuthGate } from "../components/cognito-auth-gate"

export default function DeveloperPortalPage() {
  return (
    <main className="bg-background min-h-screen">
      <CognitoAuthGate roleOverride="developer">
        <DeveloperPortalContent />
      </CognitoAuthGate>
    </main>
  )
}
