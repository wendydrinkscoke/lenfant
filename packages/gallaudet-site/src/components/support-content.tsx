"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion"
import {
  HelpCircle,
  Mail,
  MessageCircle,
  BookOpen,
  Settings,
  Users,
  AlertCircle,
  ExternalLink,
  Clock,
  CheckCircle,
} from "lucide-react"

const contactMethods = [
  {
    title: "Email Support",
    description: "Get help via email within 24 hours",
    icon: Mail,
    action: "Send Email",
    href: "mailto:support@beta.school.civictech.llc",
    availability: "24/7",
  },
  {
    title: "Help Center",
    description: "Browse our comprehensive documentation",
    icon: BookOpen,
    action: "Visit Help Center",
    href: "#help-center",
    availability: "Always available",
  },
  {
    title: "Live Chat",
    description: "Chat with our support team in real-time",
    icon: MessageCircle,
    action: "Start Chat",
    href: "#chat",
    availability: "Mon-Fri 9AM-5PM EST",
  },
]

const faqItems = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "How do I connect my Google Classroom?",
        a: "After signing in with your school Google account, click 'Connect Classroom' in your dashboard. You'll be prompted to authorize our app to access your classes. Once connected, your classes will automatically sync.",
      },
      {
        q: "What permissions does the Google Classroom Add-On need?",
        a: "Our add-on needs permission to view your classes, student rosters, create assignments, and sync grades. We only access data necessary for the educational simulation and follow strict privacy guidelines.",
      },
      {
        q: "Do students need Roblox accounts?",
        a: "Yes, students need free Roblox accounts to participate in the simulations. We recommend reviewing Roblox's safety settings and parental controls before students join.",
      },
    ],
  },
  {
    category: "Technical Issues",
    questions: [
      {
        q: "Students can't see their assignments in-game",
        a: "This usually happens when the Google Classroom sync is delayed. Check that the student is properly enrolled in your connected classroom and try refreshing the assignment sync in your teacher dashboard.",
      },
      {
        q: "Google Classroom integration stopped working",
        a: "Try disconnecting and reconnecting your Google Classroom in the settings. If the issue persists, your school's IT administrator may need to re-approve the app permissions.",
      },
      {
        q: "Grades aren't syncing back to Google Classroom",
        a: "Ensure grade passback is enabled in your assignment settings. Grades sync within 15 minutes of completion. Check that you have the necessary permissions in Google Classroom to modify grades.",
      },
    ],
  },
  {
    category: "Account & Billing",
    questions: [
      {
        q: "Can I use a personal Google account?",
        a: "No, you must use a school or educational institution email address. This ensures compliance with educational privacy regulations and proper verification of your teaching status.",
      },
      {
        q: "How do I add more students to my class?",
        a: "Students are automatically synced from your Google Classroom roster. Add students to your Google Classroom and they'll appear in Roblox NUSA Academy within 15 minutes.",
      },
      {
        q: "What happens if I leave my school?",
        a: "Contact our support team before your school email is deactivated. We can help transfer your content to a new school account or provide data export options.",
      },
    ],
  },
]

const troubleshootingSteps = [
  {
    title: "Clear Browser Cache",
    description: "Clear your browser's cache and cookies, then try logging in again.",
  },
  {
    title: "Check School Permissions",
    description: "Verify with your IT administrator that our app is approved for use in your district.",
  },
  {
    title: "Update Browser",
    description: "Ensure you're using a supported browser (Chrome, Firefox, Safari, Edge) with the latest updates.",
  },
  {
    title: "Disable Extensions",
    description: "Temporarily disable browser extensions that might interfere with Google sign-in.",
  },
]

export default function SupportContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/30" />
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="text-center">
            <Badge variant="outline" className="mb-4 border-emerald-600 text-emerald-700 dark:text-emerald-300">
              {"Support"}
            </Badge>
            <h1 className="text-4xl font-bold">{"How can we help you?"}</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {"Get the support you need to make the most of Roblox NUSA Academy in your classroom"}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Contact Methods */}
        <section className="mb-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold">{"Get in Touch"}</h2>
            <p className="mt-2 text-muted-foreground">{"Choose the support method that works best for you"}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {contactMethods.map((method) => (
              <Card key={method.title} className="relative">
                <CardHeader className="text-center">
                  <method.icon className="mx-auto h-8 w-8 text-emerald-600" />
                  <CardTitle className="text-lg">{method.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {method.availability}
                  </div>
                  <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <a href={method.href}>
                      {method.action}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Quick Troubleshooting */}
        <section className="mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-emerald-600" />
                {"Quick Troubleshooting"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{"Try these common solutions before contacting support"}</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {troubleshootingSteps.map((step, index) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <div className="mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-emerald-600" />
              {"Frequently Asked Questions"}
            </h2>
            <p className="mt-2 text-muted-foreground">{"Find answers to common questions about Roblox NUSA Academy"}</p>
          </div>

          <div className="space-y-6">
            {faqItems.map((category) => (
              <Card key={category.category}>
                <CardHeader>
                  <CardTitle className="text-lg text-emerald-700">{category.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((item, index) => (
                      <AccordionItem key={index} value={`${category.category}-${index}`}>
                        <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* System Requirements */}
        <section className="mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                {"System Requirements"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-emerald-700 mb-3">{"For Teachers"}</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"Google Workspace for Education account"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"Modern web browser (Chrome, Firefox, Safari, Edge)"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"Stable internet connection"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"School IT approval for third-party apps"}
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-emerald-700 mb-3">{"For Students"}</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"Free Roblox account"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"Roblox app or web browser"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"School Google account (for assignments)"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {"Microphone for voice chat (optional)"}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Resources */}
        <section className="mb-16">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">{"Additional Resources"}</h2>
            <p className="mt-2 text-muted-foreground">{"Helpful guides and documentation to get you started"}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                  {"Teacher Quick Start Guide"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {"Step-by-step setup instructions for new teachers"}
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  {"View Guide"}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  {"Student Onboarding"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {"Help students get started with their first simulation"}
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  {"View Guide"}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-emerald-600" />
                  {"Safety & Privacy"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {"Important information about student safety and data privacy"}
                </p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  {"Learn More"}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Emergency Contact */}
        <section>
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                <AlertCircle className="h-5 w-5" />
                {"Need Immediate Help?"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
                {
                  "If you're experiencing a critical issue that's preventing you from using Roblox NUSA Academy during class time, please contact us immediately."
                }
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="border-orange-300 text-orange-800 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-200 bg-transparent"
                >
                  <a href="mailto:urgent@beta.school.civictech.llc">
                    <Mail className="mr-2 h-4 w-4" />
                    {"Email: urgent@beta.school.civictech.llc"}
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-orange-300 text-orange-800 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-200 bg-transparent"
                >
                  <a href="#chat">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {"Start Priority Chat"}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
