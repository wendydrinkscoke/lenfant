import { Link } from "react-router-dom"
import { Menu } from 'lucide-react'
import { useState } from "react"
import { cn } from "../lib/utils"
import ViewInMarketplaceButton from "./view-in-marketplace-button"

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white font-bold">
            {"CTS"}
          </span>
          <span className="text-sm font-semibold tracking-tight">CivicTech School</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link to="#gallery" className="text-sm text-muted-foreground hover:text-foreground">
            Gallery
          </Link>
          <Link to="#features" className="text-sm text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link to="#students" className="text-sm text-muted-foreground hover:text-foreground">
            Students
          </Link>
        </nav>

        <div className="hidden md:block">
          <ViewInMarketplaceButton />
        </div>

        <button
          aria-label="Open menu"
          className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div
        className={cn(
          "md:hidden transition-[max-height] overflow-hidden border-t",
          open ? "max-h-64" : "max-h-0"
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="grid gap-3">
            <Link to="#gallery" onClick={() => setOpen(false)} className="text-sm">
              Gallery
            </Link>
            <Link to="#features" onClick={() => setOpen(false)} className="text-sm">
              Features
            </Link>
            <Link to="#students" onClick={() => setOpen(false)} className="text-sm">
              Students
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
