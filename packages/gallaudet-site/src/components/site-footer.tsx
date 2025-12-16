import { Link } from "react-router-dom"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
        <p className="text-xs text-muted-foreground">
          {"©"} {new Date().getFullYear()} {"Civic Technologies, LLC. All rights reserved."}
        </p>
        <nav className="flex items-center gap-4 text-xs">
          <Link to="/developer-info" className="text-muted-foreground hover:text-foreground">
            Developer Info
          </Link>
          <Link to="/partner-with-us" className="text-muted-foreground hover:text-foreground">
            Partner with Us
          </Link>
          <Link to="/support" className="text-muted-foreground hover:text-foreground">
            Support
          </Link>
          <Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
