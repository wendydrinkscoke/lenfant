import { Image } from "../components/ui/image"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Film, Users } from 'lucide-react'

type Clip = {
  title: string
  alt: string
  src: string
}

const inGameClips: Clip[] = [
  {
    title: "Filibuster in Session",
    alt: "Student avatar speaking during a filibuster",
    src: "/roblox-filibuster-congress-simulation.png",
  },
  {
    title: "Drafting a Bill",
    alt: "In-game UI for drafting a bill",
    src: "/roblox-bill-drafting-ui-placeholder.png",
  },
  {
    title: "Press Briefing",
    alt: "Journalists asking questions in a press room",
    src: "/roblox-press-room-placeholder.png",
  },
]

const inClassClips: Clip[] = [
  {
    title: "Engaged Classroom",
    alt: "Students collaborating on laptops",
    src: "/engaged-students-laptops-placeholder.png",
  },
  {
    title: "Small Group Strategy",
    alt: "Students planning legislative strategy",
    src: "/collaborative-students-placeholder.png",
  },
  {
    title: "Teacher Guidance",
    alt: "Teacher assisting a student at their desk",
    src: "/teacher-assisting-student-placeholder.png",
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
        {items.map((clip, i) => (
          <Card key={clip.title + i} className="overflow-hidden">
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
                {"Replace with your actual GIF: place file in /public/gifs and use that path here."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export default function GifGallery() {
  return (
    <section id="gallery" aria-labelledby="gallery-heading" className="py-16 md:py-20">
      <div className="mx-auto mb-8 max-w-6xl px-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-300">
            {"Preview"}
          </Badge>
          <h2 id="gallery-heading" className="text-2xl font-bold">
            {"See the simulation in action"}
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {
            "Showcase gameplay and your classroom—drop your own GIFs into /public/gifs and update the paths below."
          }
        </p>
      </div>

      <div className="space-y-12">
        <GalleryGrid
          title="In‑game moments"
          icon={<Film className="h-5 w-5 text-emerald-600" />}
          items={inGameClips}
        />
        <GalleryGrid
          title="In‑class engagement"
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          items={inClassClips}
        />
      </div>
    </section>
  )
}
