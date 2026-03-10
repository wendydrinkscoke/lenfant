import { Image } from "../components/ui/image"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Gamepad2, Users } from "lucide-react"

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
    src: "/run-the-world-learn-country-names-by-wendysstraw-thumbnail.png",
    description: "Learn country names by running around a life-sized map of the globe! Stand on top of a country to select it. Beat other players to that country and you'll earn more points.",
    link: "https://www.roblox.com/games/127120714583972/Run-The-World-Learn-Country-Names"
  },
  {
    title: "AP Study Game",
    alt: "Thumbnail for \"AP Study Game\" Roblox game",
    src: "/ap-study-game-by-studyverse-thumbnail.webp",
    description: "Prepare for AP exams with an independent study game featuring more than 17 courses and quiz-style practice across subjects like history, biology, psychology, reading, and math.",
    link: "https://www.roblox.com/games/138615169232956/AP-Study-Game"
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
    title: "How a Middle School Geography Teacher uses CTS and Roblox to Bring Geography to Life",
    alt: "Students planning legislative strategy",
    src: "/teaching-with-computer.jpg",
    description: "Learn about how Ms. Honey, a middle school geography teacher, integrates the educational Roblox game \"Run the World\" into her class and about how this improved learning outcomes."
  },
  {
    title: "How a High School Debate Team is using CTS and a Roblox-Based Debate Game to Prepare",
    alt: "Students collaborating on laptops",
    src: "/debate-club.jpg",
    description: "Learn about how Mr. Brady, head coach of the Oakwood High School debate team, is using CTS to give his students an edge."
  },
  {
    title: "How a High School History Teacher brought his class to Gettysburg, the Alamo, and Cairo on the same day",
    alt: "Teacher assisting a student at their desk",
    src: "/history-teacher.jpg",
    description: "\"It's like we can take a field trip anywhere.\" – Learn about how Mr. Finn takes his students to distant places and bygone times through the power of CTS and Roblox."
  },
]

function GalleryGrid({
  title,
  icon,
  items,
  id,
}: {
  title: string
  icon: React.ReactNode
  items: Clip[]
  id?: string
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4">
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
            "Below is a showcase of a few of the games we've partnered with. And every day we're partnering with new game developers who are excited to bring their games to Google Classroom™ via our Google Classroom™ Add-On. As well as a gallery showing students engaged in their classrooms."
          }
        </p>
      </div>

      <div className="space-y-12">
        <GalleryGrid
          title="Featured Games"
          icon={<Gamepad2 className="h-5 w-5 text-emerald-600" />}
          id="featured-games"
          items={inGameClips}
        />
        <GalleryGrid
          title="Success Stories"
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          id="success-stories"
          items={inClassClips}
        />
      </div>
    </section>
  )
}
