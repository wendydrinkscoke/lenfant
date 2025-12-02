import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Landmark, Gavel, Newspaper, GraduationCap } from 'lucide-react'

const teacherFeatures = [
  {
    title: "Google Classroom Sync",
    desc: "Assigning tasks can be done directly within the Google Classroom™ website.",
    icon: Landmark,
  },
  {
    title: "Automatic Grading",
    desc: "When students complete in-game tasks, CTS automatically updates their grade.",
    icon: Gavel,
  },
]

const studentFeatures = [
  {
    title: "In-Game Task Management",
    desc: "Students can see their tasks and progress both in Google Classroom™ and in-game for extra convenience.",
    icon: GraduationCap,
  },
  {
    title: "Easy Linking",
    desc: "Linking your Google Classroom account with your Roblox account takes just a few seconds.",
    icon: Newspaper,
  },
]

export default function Features() {
  return (
    <section id="features" className="border-t bg-muted/30 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10">
          <h2 className="text-2xl font-bold">{"Built for classrooms"}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {"Simple for teachers. Clear for students. Powerful learning outcomes."}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
              {"For Teachers"}
            </h3>
            <div className="grid gap-4">
              {teacherFeatures.map((f) => (
                <Card key={f.title}>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <f.icon className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div id="students">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
              {"For Students"}
            </h3>
            <div className="grid gap-4">
              {studentFeatures.map((f) => (
                <Card key={f.title}>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <f.icon className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
