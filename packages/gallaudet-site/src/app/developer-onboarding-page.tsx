import { SiteFooter } from "../components/site-footer"
import { SiteHeader } from "../components/site-header"
import DeveloperOnboardingContent from "../components/developer-onboarding-content"

export default function DeveloperOnboardingPage() {
  return (
    <main>
      <SiteHeader />
      <DeveloperOnboardingContent />
      <SiteFooter />
    </main>
  )
}
