import { Image } from "../components/ui/image"
import { Button } from "../components/ui/button"
import { Play } from 'lucide-react'
import { Link } from "react-router-dom"
import ViewInMarketplaceButton from "./view-in-marketplace-button"

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/30" />
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            {"Google Classroom-ready"}
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            {"Bring U.S. Government to life with Roblox-powered LARP simulations"}
          </h1>
          <p className="text-muted-foreground">
            {
              "Teachers connect Google Classroom, enroll students, and assign live in‑game tasks like drafting bills, filibusters, and press briefings. Students get a focused portal with their assignments."
            }
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ViewInMarketplaceButton />
            <Button asChild variant="outline">
              <Link to="#gallery" className="inline-flex items-center gap-2">
                <Play className="h-4 w-4" />
                {"See how it works"}
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {"We only support Google sign-in for schools and districts."}
          </p>
        </div>

        <div className="relative">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border shadow-sm">
            <Image
              alt="Preview of the in-game congress floor"
              src={"/placeholder.svg?height=540&width=960&query=roblox%20congress%20simulation%20wide%20screenshot"}
              fill
              className="object-cover"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg border">
              <Image
                alt="Students engaged on laptops in class"
                src={"/placeholder.svg?height=300&width=530&query=students%20in%20class%20computers%20engaged"}
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg border">
              <Image
                alt="Teacher dashboard with assignments"
                src={"/placeholder.svg?height=300&width=530&query=teacher%20dashboard%20assignments%20ui"}
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
