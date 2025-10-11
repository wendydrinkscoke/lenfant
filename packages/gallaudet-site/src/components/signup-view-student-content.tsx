
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Alert, AlertDescription } from "../components/ui/alert"
import { CheckCircle, Circle, Loader2, ExternalLink, Rocket, AlertCircle } from "lucide-react"
import { startCognitoOAuthFlowViaPopup } from "../lib/auth-utils"

type ProgressStep = {
  id: string
  label: string
  messageType: "google-signin-complete" | "google-oauth-scopes-received" | "roblox-sign-in-complete"
  completed: boolean
}

export default function SignupViewStudentContent() {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState<ProgressStep[]>([
    {
      id: "google-signin",
      label: "Sign in with your Google account",
      messageType: "google-signin-complete",
      completed: false,
    },
    {
      id: "oauth-scopes",
      label: "Grant classroom.addons.student OAuth scope",
      messageType: "google-oauth-scopes-received",
      completed: false,
    },
    {
      id: "roblox-link",
      label: "Link your Roblox account",
      messageType: "roblox-sign-in-complete",
      completed: false,
    },
  ])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      const { type } = data;

      if (
        type === "google-signin-complete" ||
        type === "google-oauth-scopes-received" ||
        type === "roblox-sign-in-complete"
      ) {
        setSteps((prevSteps) =>
          prevSteps.map((step) => (step.messageType === type ? { ...step, completed: true } : step)),
        )
        return
      }

      if (type === "cognito-auth-complete") {
        setIsPopupOpen(false)
        if (data.ok) {
          setErrorMessage(null)
        } else {
          setErrorMessage("We couldn't finish linking your accounts. Please try again.")
        }
        return
      }
    }

    window.addEventListener("message", handler)

    return () => {
      window.removeEventListener("message", handler)
    }
  }, [])

  const handleGetStarted = () => {
    setErrorMessage(null)
    setSteps((prev) => prev.map((step) => ({ ...step, completed: false })))
    const popup = startCognitoOAuthFlowViaPopup({
      includeRobloxAssociation: true,
      roleOverride: "student",
    })
    if (popup) {
      setIsPopupOpen(true)
      popup.focus()
    } else {
      setIsPopupOpen(false)
      setErrorMessage("We couldn't open a sign-in popup. Please allow popups in your browser and try again.")
    }
  }

  const allStepsComplete = steps.every((step) => step.completed)
  const currentStep = steps.findIndex((step) => !step.completed)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Rocket className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl md:text-3xl">{"Link your School and Roblox Accounts"}</CardTitle>
            <CardDescription className="text-base">
              {
                "Your teacher is inviting you to play in a fun and educational game! To get started, you'll need to link your Roblox and Google Classroom accounts."
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
              <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">{"Don't have a Roblox account yet? "}</span>
                {"You'll need to create one first. "}
                <a
                  href="https://www.roblox.com/CreateAccount"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
                >
                  {"Create a Roblox account here"}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {", then come back to this assignment afterwards."}
              </AlertDescription>
            </Alert>

            {!allStepsComplete && (
              <div className="flex justify-center">
                <Button
                  onClick={handleGetStarted}
                  disabled={isPopupOpen && currentStep > 0}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8"
                >
                  {isPopupOpen && currentStep > 0 ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {"Continue in popup..."}
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </div>
            )}

            {errorMessage && (
              <Alert className="border-destructive/20 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Progress Indicator */}
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-semibold text-center text-muted-foreground uppercase tracking-wide">
                {"Setup Progress"}
              </h3>

              <div className="space-y-3">
                {steps.map((step, index) => {
                  const isActive = index === currentStep
                  const isPast = step.completed

                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                        isPast
                          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                          : isActive
                            ? "bg-emerald-50/50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700"
                            : "bg-muted/30 border-muted"
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {isPast ? (
                          <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        ) : isActive ? (
                          <div className="relative">
                            <Circle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                            </div>
                          </div>
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            isPast
                              ? "text-emerald-900 dark:text-emerald-100"
                              : isActive
                                ? "text-foreground"
                                : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </p>
                        {isPast && <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{"Complete!"}</p>}
                        {isActive && (
                          <p className="text-xs text-muted-foreground mt-1">{"In progress - continue in the popup"}</p>
                        )}
                      </div>

                      <div className="flex-shrink-0 text-xs font-medium text-muted-foreground">{`${index + 1}/3`}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Success Message */}
            {allStepsComplete && (
              <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                  <span className="font-semibold">{"All set! "}</span>
                  {
                    "Your accounts are now linked. You can now access your assignments in the Roblox game. Check your Google Classroom for the game link!"
                  }
                </AlertDescription>
              </Alert>
            )}

            {/* Help Text */}
            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                {"Need help? "}
                <a href="/support" target="_blank" className="text-emerald-600 hover:underline" rel="noreferrer">
                  {"Contact support"}
                </a>
                {" or ask your teacher for assistance."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
