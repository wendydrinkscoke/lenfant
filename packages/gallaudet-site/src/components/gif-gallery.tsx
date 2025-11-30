import { Image } from "../components/ui/image"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Gamepad2, Users } from 'lucide-react'

type Clip = {
  title: string
  alt: string
  src: string
  description: string
  link?: string
}

const inGameClips: Clip[] = [
  {
    title: "Run The World! - Learn Country Names",
    alt: "Student avatar speaking during a filibuster",
    src: "/run-the-world-learn-country-names-thumbnail.png",
    description: "Learn country names by running around a life-sized map of the globe! Stand on top of a country to select it. Beat other players to that country and you'll earn more points.",
    link: "https://www.roblox.com/games/127120714583972/Run-The-World-Learn-Country-Names"
  },
  {
    title: "Tour the George W. Bush Presidential Library",
    alt: "In-game UI for drafting a bill",
    src: "/gwb-lib-thumbnail.png",
    description: "Learn about the 43rd President of the United State by touring a bloxy version of his Presidential library!",
    link: "https://www.roblox.com/games/127120714583341/Tour-The-GWB-Library"
  },
]

const inClassClips: Clip[] = [
  {
    title: "Oakwood High School",
    alt: "Students collaborating on laptops",
    src: "/engaged-students-laptops-placeholder.png",
    description: "Engaging age-appropriate content for all ages."
  },
  {
    title: "Mountain View Middle School",
    alt: "Students planning legislative strategy",
    src: "/collaborative-students-placeholder.png",
    description: "Engaged students"
  },
  {
    title: "Paul J. Rogers Preparatory School",
    alt: "Teacher assisting a student at their desk",
    src: "/teacher-assisting-student-placeholder.png",
    description: "Better learning outcomes"
  },
]

function GalleryGrid({ title, icon, items }: { title: string; icon: React.ReactNode; items: Clip[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4">
      <div className="mb-6 flex items-center gap-2">
        {icon}
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((clip, i) => {
          const isLinked = Boolean(clip.link)
          const card = (
            <Card className={`h-full overflow-hidden transition-shadow ${isLinked ? "cursor-pointer hover:shadow-lg focus-within:shadow-lg" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">{clip.title}</CardTitle>
                <Badge variant="secondary">{"GIF"}</Badge>
              </CardHeader>
              <CardContent className="relative">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border">
                  <Image
                    alt={clip.alt}
                    src={clip.src || "/placeholder.svg"}
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {clip.description}
                </p>
              </CardContent>
            </Card>
          )

          return clip.link ? (
            <a
              key={clip.title + i}
              href={clip.link}
              target="_blank"
              rel="noreferrer"
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {card}
            </a>
          ) : (
            <div key={clip.title + i}>{card}</div>
          )
        })}
      </div>
    </section>
  )
}

export default function GifGallery() {
  return (
    <section id="gallery" aria-labelledby="gallery-heading" className="py-16 md:py-20">
      <div className="mx-auto mb-8 max-w-6xl px-4">
        <div className="flex items-center gap-2">
          <h2 id="gallery-heading" className="text-2xl font-bold">
            {"The Experience"}
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {
            "Below is a showcase of a few of the games we've partnered with. And every day we're partnering with new game developers who are excited to bring their games to Google Classrooms via our Classrooms Add-On. As well as a gallery showing students engaged in their classrooms."
          }
        </p>
      </div>

      <div className="space-y-12">
        <GalleryGrid
          title="Featured Games"
          icon={<Gamepad2 className="h-5 w-5 text-emerald-600" />}
          items={inGameClips}
        />
        <GalleryGrid
          title="Success Stories"
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          items={inClassClips}
        />
      </div>
    </section>
  )
}
