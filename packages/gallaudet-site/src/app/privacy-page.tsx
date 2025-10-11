import { SiteHeader } from "../components/site-header"
import { SiteFooter } from "../components/site-footer"
import PrivacyContent from "../components/privacy-content"

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <PrivacyContent />
      <SiteFooter />
    </main>
  )
}
