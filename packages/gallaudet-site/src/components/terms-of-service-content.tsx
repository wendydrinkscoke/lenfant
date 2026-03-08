import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Shield, BookOpen, Users, AlertTriangle } from "lucide-react"

export default function TermsOfServiceContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/30" />
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="text-center">
            <Badge variant="outline" className="mb-4 border-emerald-600 text-emerald-700 dark:text-emerald-300">
              {"Legal"}
            </Badge>
            <h1 className="text-4xl font-bold">{"Terms of Service"}</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {"Last updated: "}
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="prose prose-gray max-w-none dark:prose-invert">
          {/* Introduction */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                {"Introduction"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {
                  'Welcome to CTS. These Terms of Service ("Terms") govern your use of our web application and Google Classroom Add-On that enables political science teachers to host LARP (Live Action Role Playing) simulations on Roblox.'
                }
              </p>
              <p>
                {
                  "By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of these terms, you may not access our services."
                }
              </p>
            </CardContent>
          </Card>

          {/* Web Application Terms */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                {"Web Application Usage"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Account Registration"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"You must use a valid school or educational institution email address"}</li>
                  <li>{"Only Google sign-in is supported for authentication"}</li>
                  <li>{"You are responsible for maintaining the security of your account"}</li>
                  <li>{"One account per user; sharing accounts is prohibited"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Acceptable Use"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Use the service only for educational purposes"}</li>
                  <li>{"Do not attempt to circumvent security measures"}</li>
                  <li>{"Respect intellectual property rights"}</li>
                  <li>{"Follow your institution's technology policies"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Teacher Responsibilities"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Ensure students have appropriate permissions to participate"}</li>
                  <li>{"Monitor student activity and behavior during simulations"}</li>
                  <li>{"Comply with FERPA and other applicable privacy regulations"}</li>
                  <li>{"Use assignments and content for educational purposes only"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Google Classroom Add-On Terms */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                {"Google Classroom Add-On"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Integration Permissions"}</h4>
                <p className="text-sm mb-2">{"Our Google Classroom Add-On requires the following permissions:"}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"View your Google Classroom classes"}</li>
                  <li>{"View your students' profiles and email addresses"}</li>
                  <li>{"Create and manage assignments"}</li>
                  <li>{"View assignment submissions and grades"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Data Synchronization"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Student roster information is synchronized from Google Classroom"}</li>
                  <li>{"Assignment data flows between our platform and Google Classroom"}</li>
                  <li>{"Grade passback occurs automatically when enabled"}</li>
                  <li>{"Synchronization may be delayed up to 15 minutes"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Add-On Limitations"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Requires active Google Workspace for Education account"}</li>
                  <li>{"Subject to Google's API usage limits and policies"}</li>
                  <li>{"May be temporarily unavailable during Google maintenance"}</li>
                  <li>{"Functionality depends on your Google Classroom permissions"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Privacy and Data */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                {"Privacy and Data Protection"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Student Data"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"We collect only necessary educational data"}</li>
                  <li>{"Student data is used solely for educational purposes"}</li>
                  <li>{"We comply with COPPA, FERPA, and applicable state privacy laws"}</li>
                  <li>{"Data is encrypted in transit and at rest"}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Data Retention"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Student data is retained only as long as necessary"}</li>
                  <li>{"Data is deleted when a student is removed from a class"}</li>
                  <li>{"Account data is deleted within 30 days of account closure"}</li>
                  <li>{"Anonymized usage data may be retained for service improvement"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Roblox Integration */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-emerald-600" />
                {"Roblox Integration"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {"Our service integrates with Roblox to provide educational simulations. Please note:"}
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{"Students must have valid Roblox accounts to participate"}</li>
                <li>{"Roblox's Terms of Service and Community Standards apply"}</li>
                <li>{"We are not responsible for Roblox platform availability"}</li>
                <li>{"Teachers should review Roblox's safety features and parental controls"}</li>
                <li>{"In-game behavior is subject to both our terms and Roblox's policies"}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Service Availability */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{"Service Availability and Modifications"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{"We strive for 99.9% uptime but cannot guarantee uninterrupted service"}</li>
                <li>{"Scheduled maintenance will be announced in advance when possible"}</li>
                <li>{"We reserve the right to modify or discontinue features with notice"}</li>
                <li>{"Emergency maintenance may occur without prior notice"}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{"Limitation of Liability"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {
                  "TO THE MAXIMUM EXTENT PERMITTED BY LAW, CIVIC TECH FOR SCHOOLS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR BUSINESS INTERRUPTION."
                }
              </p>
              <p className="text-sm">
                {
                  "Our total liability for any claims arising from these terms or your use of our services shall not exceed the amount paid by you for our services in the twelve months preceding the claim."
                }
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{"Account Termination"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"By You"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"You may terminate your account at any time"}</li>
                  <li>{"Contact support to request account deletion"}</li>
                  <li>{"Data will be deleted according to our retention policy"}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"By Us"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"We may suspend or terminate accounts for Terms violations"}</li>
                  <li>{"Notice will be provided when possible"}</li>
                  <li>{"Immediate termination may occur for serious violations"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{"Changes to These Terms"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {"We reserve the right to modify these Terms at any time. We will notify users of material changes by:"}
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{"Email notification to registered users"}</li>
                <li>{"Prominent notice on our website"}</li>
                <li>{"In-app notifications when you next log in"}</li>
              </ul>
              <p className="text-sm">
                {"Continued use of our services after changes constitutes acceptance of the new Terms."}
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>{"Contact Us"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">{"If you have questions about these Terms of Service, please contact us:"}</p>
              <div className="space-y-2 text-sm">
                <p>{"Email: legal@beta.school.civictech.llc"}</p>
                <p>{"Support: https://vercel.com/help"}</p>
                <p>{"Address: [Your Business Address]"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
