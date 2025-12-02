import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Separator } from "../components/ui/separator"
import { Building2, GraduationCap, Gamepad2, HeartHandshake, Target, Mail } from "lucide-react"

export default function DeveloperInfoContent() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/30" />
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="text-center">
            <Badge variant="outline" className="mb-4 border-emerald-600 text-emerald-700 dark:text-emerald-300">
              {"Developer"}
            </Badge>
            <h1 className="text-4xl font-bold">{"About Civic Technologies, LLC."}</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {
                "We build playful learning experiences that make pre-college education more engaging for students and easier for teachers to deliver."
              }
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {"Who we are"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {
                "Civic Technologies, LLC. is an education-focused studio dedicated to bringing hands-on learning to life through interactive simulations and games."
              }
            </p>
            <p>
              {
                "Our team combines educators, designers, and engineers who care deeply about making classroom content relatable for students everywhere."
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              {"What we aim to do"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <GraduationCap className="h-5 w-5" />
                {"Pre-college learning, reimagined"}
              </div>
              <p className="text-sm text-muted-foreground">
                {
                  "We focus on the pre-college years, turning academic standards into playable scenarios that prepare students for the next step."
                }
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <Gamepad2 className="h-5 w-5" />
                {"Built for Roblox"}
              </div>
              <p className="text-sm text-muted-foreground">
                {
                  "Roblox is our primary platform because it meets students where they already play. We design safe, teacher-guided experiences that plug into classroom assignments."
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-emerald-600" />
              {"Our commitments"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-2">
              <li>{"Keep students safe by following education-focused privacy practices."}</li>
              <li>{"Support teachers with straightforward tools that fit into existing workflows."}</li>
              <li>{"Measure learning outcomes so playful experiences still produce results."}</li>
            </ul>
            <Separator />
            <p className="text-xs">
              {
                "Every release is reviewed for educational value, accessibility, and alignment with school technology policies."
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-600" />
              {"Contact"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>{"Email: cupwendyscup@gmail.com"}</p>
            <p>{"Company: Civic Technologies, LLC."}</p>
            <p>{"Focus: Pre-college education made engaging through Roblox-based learning experiences."}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
