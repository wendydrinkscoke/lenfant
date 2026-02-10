import type { ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { ArrowRight, BookOpen, Download, FileCode2, Lightbulb } from "lucide-react"
import { partnerExplainers, partnerGuides } from "../../content/partner-docs"
import { cn } from "../../lib/utils"
import { SiteFooter } from "../site-footer"
import { SiteHeader } from "../site-header"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Separator } from "../ui/separator"

type PartnerDocsShellProps = {
  badge?: string
  title: string
  description: string
  children: ReactNode
}

const baseItems = [
  {
    to: "/create/docs",
    label: "Overview",
    icon: BookOpen,
  },
  {
    to: "/create/docs/api",
    label: "API reference",
    icon: FileCode2,
  },
  {
    to: "/create/docs/guides",
    label: "Guides",
    icon: ArrowRight,
  },
  {
    to: "/create/docs/explainers",
    label: "Explainers",
    icon: Lightbulb,
  },
  {
    to: "/create/docs/downloads",
    label: "Downloads",
    icon: Download,
  },
]

const isSameSection = (pathname: string, to: string) => {
  if (to === "/create/docs") {
    return pathname === to
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function PartnerDocsShell({
  badge = "Partner Docs",
  title,
  description,
  children,
}: PartnerDocsShellProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_hsl(149_80%_92%),_transparent_55%),radial-gradient(circle_at_bottom_left,_hsl(217_100%_95%),_transparent_45%)]" />
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-16">
          <div className="max-w-4xl space-y-4">
            <Badge variant="outline" className="border-emerald-600 text-emerald-700">
              {badge}
            </Badge>
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">{title}</h1>
            <p className="text-base text-muted-foreground md:text-lg">{description}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/create/docs/api">View API reference</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/create/docs/downloads">Download client starter</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[280px_minmax(0,1fr)] md:py-12">
        <aside className="space-y-6 md:sticky md:top-20 md:h-fit">
          <div className="rounded-xl border bg-card p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Navigation
            </p>
            <nav className="space-y-1">
              {baseItems.map((item) => {
                const active = isSameSection(location.pathname, item.to)
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <div className="rounded-xl border bg-card p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Guides
            </p>
            <div className="space-y-1">
              {partnerGuides.map((guide) => (
                <NavLink
                  key={guide.slug}
                  to={`/create/docs/guides/${guide.slug}`}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-2 py-2 text-sm",
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  {guide.title}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Explainers
            </p>
            <div className="space-y-1">
              {partnerExplainers.map((explainer) => (
                <NavLink
                  key={explainer.slug}
                  to={`/create/docs/explainers/${explainer.slug}`}
                  className={({ isActive }) =>
                    cn(
                      "block rounded-md px-2 py-2 text-sm",
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  {explainer.title}
                </NavLink>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          {children}
          <Separator />
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Need integration help?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Email our partner engineering team and include your experience ID plus any failing API payloads.
            </p>
            <Button className="mt-3" variant="outline" asChild>
              <a href="mailto:cupwendyscup@gmail.com">Contact support</a>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
