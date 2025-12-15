import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { SiteHeader } from "../components/site-header"
import Hero from "../components/hero"
import GifGallery from "../components/gif-gallery"
import Features from "../components/features"
import { SiteFooter } from "../components/site-footer"

export default function MarketingPage() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const scrollTarget = (location.state as { scrollTo?: string } | null)?.scrollTo
    if (!scrollTarget) {
      return
    }
    const element = document.getElementById(scrollTarget)
    const header = document.querySelector("header")
    const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0
    const buffer = 8

    const scrollTo = () => {
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - buffer
        window.scrollTo({ top, behavior: "auto" })
      } else {
        window.scrollTo({ top: 0, behavior: "auto" })
      }
    }

    // Run on next tick to ensure DOM is ready after navigation.
    const timer = window.setTimeout(scrollTo, 0)
    navigate(".", { replace: true, state: {} })

    return () => window.clearTimeout(timer)
  }, [location.state, navigate])

  return (
    <main>
      <SiteHeader />
      <Hero />
      <GifGallery />
      <Features />
      <SiteFooter />
    </main>
  )
}
