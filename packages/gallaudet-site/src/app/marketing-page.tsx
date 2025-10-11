import { SiteHeader } from "../components/site-header"
import Hero from "../components/hero"
import GifGallery from "../components/gif-gallery"
import Features from "../components/features"
import { SiteFooter } from "../components/site-footer"

export default function MarketingPage() {
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
