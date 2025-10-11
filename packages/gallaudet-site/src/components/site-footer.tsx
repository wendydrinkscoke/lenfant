import { Link } from "react-router-dom"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
        <p className="text-xs text-muted-foreground">
          {"©"} {new Date().getFullYear()} {"CivicTech, LLC. All rights reserved."}
        </p>
        <nav className="flex items-center gap-4 text-xs">
          <Link to="#features" className="text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link to="#gallery" className="text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
          <a href="https://support.google.com/edu/classroom" className="text-muted-foreground hover:text-foreground">
            Support
          </a>
        </nav>
      </div>
    </footer>
  )
}
