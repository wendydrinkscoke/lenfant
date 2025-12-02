import { SiteHeader } from "../components/site-header"
import { SiteFooter } from "../components/site-footer"
import DeveloperInfoContent from "../components/developer-info-content"

export default function DeveloperInfoPage() {
  return (
    <main>
      <SiteHeader />
      <DeveloperInfoContent />
      <SiteFooter />
    </main>
  )
}
