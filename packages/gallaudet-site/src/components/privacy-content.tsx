import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Alert, AlertDescription } from "../components/ui/alert"
import { Shield, Eye, Database, Users, Lock, Globe, Trash2, UserCheck, AlertTriangle, School } from "lucide-react"

export default function PrivacyContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/30" />
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="text-center">
            <Badge variant="outline" className="mb-4 border-emerald-600 text-emerald-700 dark:text-emerald-300">
              {"Privacy"}
            </Badge>
            <h1 className="text-4xl font-bold">{"Privacy Policy"}</h1>
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
          {/* Student Privacy Alert */}
          <Alert className="mb-8 border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <School className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200">
              <strong>{"Student Privacy First:"}</strong>{" "}
              {
                "We are committed to protecting student privacy and comply with COPPA, FERPA, and state student privacy laws. We collect only the minimum data necessary for educational purposes and never sell or share student data for commercial purposes."
              }
            </AlertDescription>
          </Alert>

          {/* Introduction */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-emerald-600" />
                {"Introduction"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {
                  "This Privacy Policy describes how Civic LARP collects, uses, and protects information when you use our web application and Google Classroom Add-On for educational LARP simulations on Roblox."
                }
              </p>
              <p>
                {
                  "We take privacy seriously, especially when it comes to student data. This policy explains our practices in clear, understandable terms."
                }
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-600" />
                {"Information We Collect"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Teacher Information"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Name (from Google sign-in)"}</li>
                  <li>{"Usage data and activity logs"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Student Information"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Name (from Google Sign-In)"}</li>
                  <li>{"Roblox username (from Roblox Sign-In)"}</li>
                  <li>{"Assignment milestone completion status and grades"}</li>
                  <li>{"In-game activity related to educational assignments"}</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  {
                    "We do NOT collect: Social Security numbers, financial information, biometric data, or personal information unrelated to education."
                  }
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Technical Information"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Usage analytics and performance data"}</li>
                  <li>{"Error logs and diagnostic information"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Information */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                {"How We Use Your Information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Educational Purposes Only"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Provide and improve our educational simulation platform"}</li>
                  <li>{"Sync assignments and grades with Google Classroom"}</li>
                  <li>{"Track student progress on educational activities"}</li>
                  <li>{"Generate reports for teachers and administrators"}</li>
                  <li>{"Provide technical support and troubleshooting"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Service Operations"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Authenticate users and maintain account security"}</li>
                  <li>{"Ensure compliance with educational regulations"}</li>
                </ul>
              </div>

              <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">{"We Never:"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                  <li>{"Sell student data to third parties"}</li>
                  <li>{"Use student data for advertising or marketing"}</li>
                  <li>{"Share data for non-educational commercial purposes"}</li>
                  <li>{"Create profiles of students for non-educational purposes"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Google Classroom Integration */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                {"Google Classroom Integration"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Data We Access"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"List the courses a student is enrolled in (used transiently and not stored)"}</li>
                  <li>{"View metadata about student submissions (used transiently and not stored)"}</li>
                  <li>{"Create attachments for Google Classroom assignments"}</li>
                  <li>{"Automatically grade attachments for Google Classroom assignments we created"}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Google's Privacy Protections"}</h4>
                <p className="text-sm">
                  {
                    "Our integration with Google Classroom is subject to Google's privacy policies and security standards. We use Google's secure APIs and follow their guidelines for educational applications."
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Roblox Integration */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-600" />
                {"Roblox Platform Integration"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Data We Access"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"The identity of the user who authenticated to our Roblox OAuth client"}</li>
                  <li>{"This identity is linked to the user's Google identity."}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"What We Share with our Roblox \"experiences\" (game servers)"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"View the list of tasks assigned to a particular Roblox user associated with that specific experience's game"}</li>
                  <li>{"Read the current tentative grade the student has earned for each task associated with that specific experience's game"}</li>
                  <li>{"Update the current tentative grade the student has earned for each task associated with that specific experience's game"}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Roblox's Privacy Policy"}</h4>
                <p className="text-sm">
                  {
                  "Students' interactions on the Roblox platform are governed by "
                  }
                  <a href="https://en.help.roblox.com/hc/en-us/articles/115004630823-Roblox-Privacy-and-Cookie-Policy" className="text-emerald-600 hover:underline dark:text-emerald-400">
                  {"Roblox's own privacy policy and terms of service"}
                  </a>
                  {
                  ". We recommend reviewing Roblox's privacy practices and safety features."
                  }
                </p>
              </div>

              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  {
                    "We never share with our experiences the Google identity linked to a particular Roblox user and experiences are unable to view assignemtns or tentative grades other than those which they manage."
                  }
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Data Sharing and Third Parties */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                {"Data Sharing and Third Parties"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Limited Sharing"}</h4>
                <p className="text-sm mb-2">{"We only share data in these specific circumstances:"}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"With our Roblox experiences (limited to assignment identifiers and tentative grades associated with that specific experience) so they can display grades in-game and update grades based on in-game activity"}</li>
                  <li>
                    {
                      "With our cloud provider (Amazon Web Services) who helps us operate our platform (under strict data protection service-level agreements)"
                    }
                  </li>
                  <li>{"When required by law or to protect safety"}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600" />
                {"Data Security"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Security Measures"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Data encryption in transit and at rest"}</li>
                  <li>{"Secure authentication through Google OAuth"}</li>
                  <li>{"Regular security audits and monitoring"}</li>
                  <li>{"Fine-grained access controls via IAM"}</li>
                  <li>{"Incident response and breach notification procedures"}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Data Centers"}</h4>
                <p className="text-sm">
                  {
                    "Our data is stored in data centers in the United States. We use industry-standard security practices to protect against unauthorized access, alteration, disclosure, or destruction."
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Retention and Deletion */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-emerald-600" />
                {"Data Retention and Deletion"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Retention Periods"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Student data: Retained only while enrolled in connected classes"}</li>
                  <li>{"Assignment data: Retained for the duration of the academic year"}</li>
                  <li>{"Teacher account data: Retained while account is active"}</li>
                  <li>{"Usage logs: Retained for up to 2 years for security and improvement purposes"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Automatic Deletion"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Student data is automatically deleted when removed from Google Classroom"}</li>
                  <li>{"Account data is deleted within 30 days of account closure"}</li>
                  <li>{"Inactive accounts are automatically deleted after 2 years"}</li>
                  <li>{"Backup data is securely destroyed according to our retention schedule"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Data Export and Portability"}</h4>
                <p className="text-sm">
                  {
                    "Teachers can request a copy of their data at any time. We provide data in standard formats for easy transfer to other platforms."
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Your Rights and Controls */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                {"Your Rights and Controls"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Teacher Rights"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Access and review all data we have about you and your students"}</li>
                  <li>{"Correct inaccurate information"}</li>
                  <li>{"Delete your account and associated data"}</li>
                  <li>{"Export your data in a portable format"}</li>
                  <li>{"Control which classes are connected to our platform"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Student and Parent Rights"}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>{"Parents can request to see their child's data"}</li>
                  <li>{"Parents can request correction or deletion of their child's data"}</li>
                  <li>{"Students can be removed from the platform at any time"}</li>
                  <li>{"Parents can contact us directly with privacy concerns"}</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"How to Exercise Your Rights"}</h4>
                <p className="text-sm">
                  {
                    "Contact us at cupwendyscup@gmail.com to exercise any of these rights. We will respond within 30 days and verify your identity before processing requests."
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cookies and Tracking */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{"Cookies and Tracking Technologies"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"Essential Cookies"}</h4>
                <p className="text-sm">
                  {
                    "We use essential cookies to maintain your login session and provide core functionality. These cannot be disabled."
                  }
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-emerald-700 mb-2">{"No Advertising Tracking"}</h4>
                <p className="text-sm">
                  {
                    "We do not use cookies or tracking technologies for advertising purposes or to create marketing profiles."
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Changes to Privacy Policy */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{"Changes to This Privacy Policy"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {"We may update this Privacy Policy from time to time. We will notify you of material changes by:"}
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{"Email notification to all registered teachers"}</li>
                <li>{"Prominent notice on our website"}</li>
                <li>{"In-app notifications when you next log in"}</li>
              </ul>
              <p className="text-sm">
                {
                  "We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information."
                }
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>{"Contact Us About Privacy"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">
                {"If you have questions about this Privacy Policy or our data practices, please contact us at cupwendyscup@gmail.com"}
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                {"We are committed to resolving privacy concerns promptly and transparently."}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
