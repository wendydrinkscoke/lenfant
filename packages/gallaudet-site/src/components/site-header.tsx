import { Link, useLocation, useNavigate } from "react-router-dom"
import { Menu } from "lucide-react"
import { useCallback, useState } from "react"
import { cn } from "../lib/utils"
import ViewInMarketplaceButton from "./view-in-marketplace-button"

type NavItem =
  | { label: string; targetId: string; to?: never }
  | { label: string; to: string; targetId?: never }

const navItems: NavItem[] = [
  { label: "Games", targetId: "featured-games" },
  { label: "Stories", targetId: "success-stories" },
  { label: "Features", targetId: "features" },
  { label: "Partner with Us", to: "/developer-onboarding" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const handleNavClick = useCallback((targetId?: string) => {
    if (!targetId) {
      return
    }
    if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: targetId } })
      setOpen(false)
      return
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      return
    }
    const el = document.getElementById(targetId)
    if (el) {
      const header = document.querySelector("header")
      const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0
      const buffer = 8
      const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - buffer
      window.scrollTo({ top, behavior: "smooth" })
      window.history.replaceState(null, "", `#${targetId}`)
    }
    setOpen(false)
  }, [location.pathname, navigate])
  
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white font-bold">
            {"CTS"}
          </span>
          <span className="text-sm font-semibold tracking-tight">CivicTech for Schools</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) =>
            "targetId" in item ? (
              <button
                key={item.targetId}
                type="button"
                onClick={() => handleNavClick(item.targetId)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            )
          )}
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
            {navItems.map((item) =>
              "targetId" in item ? (
                <button
                  key={item.targetId}
                  type="button"
                  onClick={() => handleNavClick(item.targetId)}
                  className="text-left text-sm"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-left text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
