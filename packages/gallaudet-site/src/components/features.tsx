import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Landmark, Gavel, Newspaper, GraduationCap } from 'lucide-react'

const teacherFeatures = [
  {
    title: "Google Classroom Sync",
    desc: "Sign in with your school account, import classes, and enroll students automatically.",
    icon: Landmark,
  },
  {
    title: "Live Assignments",
    desc: "Assign tasks like drafting or filibustering a bill—students see them in‑game.",
    icon: Gavel,
  },
]

const studentFeatures = [
  {
    title: "Focused Portal",
    desc: "Students sign in and see only their assignments, deadlines, and progress.",
    icon: GraduationCap,
  },
  {
    title: "Authentic Roles",
    desc: "Play as representatives, journalists, and more to learn civic processes hands-on.",
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
