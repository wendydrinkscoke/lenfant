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
            {"Bring classwork to life with educational Roblox games"}
          </h1>
          <p className="text-muted-foreground">
            {
              "Our Google Classroom Add-On makes it simple for teachers to assign in-game tasks to students, which are automatically graded upon completion. We've partnered with lots of the best educational Roblox games so you'll never run out of fun worlds to explore!"
            }
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ViewInMarketplaceButton />
            <Button asChild variant="outline">
              <Link to="https://www.youtube.com/watch?v=zSuMbEFIFMA" className="inline-flex items-center gap-2">
                <Play className="h-4 w-4" />
                {"See how it works"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl border shadow-sm">
            <Image
              alt="Demo of a student playing 'Run the World', an educational game to learn countries."
              src={"/run-the-world-gameplay.gif"}
              fill
              className="object-cover"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <p className="text-sm font-medium leading-snug text-white drop-shadow">
                {"A student playing 'Run the World', an educational game to learn countries. All the tasks they see in-game were assigned via Google Classroom™ and are automatically graded when they complete the task."}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="group relative aspect-[16/10] overflow-hidden rounded-lg border">
              <Image
                alt="Demo of a student playing 'Tour the George W. Bush Presidential Library', an educational game to learn about the presidency and life of the 43rd U.S. President"
                src={"/gwb-lib-gameplay.gif"}
                fill
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="text-xs font-semibold leading-snug text-white drop-shadow">
                  {"A student playing 'Tour the George W. Bush Presidential Library', an educational game to learn about the presidency and life of the 43rd U.S. President"}
                </p>
              </div>
            </div>
            <div className="group relative aspect-[16/10] overflow-hidden rounded-lg border">
              <Image
                alt="A demonstration, from a teacher's perspective, of attaching an in-game task to an assignment using our Google Classroom Add-On"
                src={"/google-classroom-integration-demo.gif"}
                fill
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="text-xs font-semibold leading-snug text-white drop-shadow">
                  {"A teacher attaching an in-game task to an assignment using our Google Classroom Add-On."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
