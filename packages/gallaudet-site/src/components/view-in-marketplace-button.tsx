import { Button } from "../components/ui/button"
import { Chrome } from 'lucide-react'

export default function ViewInMarketplaceButton({
  label = "View in Marketplace",
}: {
  label?: string
  redirectPath?: string
  enableRedirect?: boolean
}) {

  function getMarketplaceUrlForStateBasedOnDomain() {
    const domain = window.location.hostname
    if (domain.includes("beta") || domain.includes("localhost")) {
      return "https://workspace.google.com/marketplace/app/civictech_for_school/654823757539"
    } else if (domain.includes("gamma")) {
      return "https://workspace.google.com/marketplace/app/civictech_for_schools_gamma/949890986084"
    } else {
      return "https://workspace.google.com/marketplace/app/civictech_for_schools/746530268672"
    }
  }

  return (
    <Button
      onClick={() => {
        const url = getMarketplaceUrlForStateBasedOnDomain()
        window.open(url)
      }}
      className="bg-emerald-600 hover:bg-emerald-700"
      aria-label={label}
    >
      <Chrome className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}