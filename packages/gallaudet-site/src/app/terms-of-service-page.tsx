import { SiteHeader } from "../components/site-header"
import { SiteFooter } from "../components/site-footer"
import TermsOfServiceContent from "../components/terms-of-service-content"

export default function TermsPage() {
  return (
    <main>
      <SiteHeader />
      <TermsOfServiceContent />
      <SiteFooter />
    </main>
  )
}
