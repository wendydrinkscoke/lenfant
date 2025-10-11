import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Alert, AlertDescription } from "../components/ui/alert"
import { Button } from "../components/ui/button"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import AttachmentForm from "../components/attachment-form"
import { useAuth } from "../hooks/use-auth"
import { startCognitoOAuthFlowViaPopup } from "../lib/auth-utils"

export default function CreateAttachmentContent() {
  const [searchParams] = useSearchParams()
  const loginHint = searchParams.get("login_hint")
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)          // ✅ keep local spinner state
  const [showMultiLoginError, setShowMultiLoginError] = useState(false)

  const { user, isSignedIn, checkAuth, signOut } = useAuth()

  // 1) Initial check on mount / when loginHint changes
  useEffect(() => {
    (async () => {
      setIsCheckingAuth(true)
      try {
        await checkAuth(loginHint)
        setShowMultiLoginError(false)
      } catch (e: any) {
        if (e?.code === "LOGIN_HINT_MISMATCH") setShowMultiLoginError(true)
        // NO_SESSION etc → show sign-in screen
      } finally {
        setIsCheckingAuth(false)
      }
    })()
  }, [checkAuth, loginHint])

  // 2) Listen for popup completion and re-check
  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type !== "cognito-auth-complete") return;

      setIsCheckingAuth(true);
      try {
        if (ev.data?.ok) {
          if (ev.data.idToken)      localStorage.setItem("id_token", ev.data.idToken);
          if (ev.data.accessToken)  localStorage.setItem("access_token", ev.data.accessToken);
          if (ev.data.refreshToken) localStorage.setItem("refresh_token", ev.data.refreshToken);

          await checkAuth(loginHint || undefined);
          setShowMultiLoginError(false);
        } else {
          setShowMultiLoginError(true);
        }
      } catch (e: any) {
        if (e?.code === "LOGIN_HINT_MISMATCH") setShowMultiLoginError(true);
        console.error(e);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkAuth, loginHint]);

  const handleCognitoSignIn = () => {
    try {
        startCognitoOAuthFlowViaPopup(loginHint || undefined);
    } catch (e: any) {
      if (e?.message === "POPUP_BLOCKED") {
        // optionally show a more specific hint
      }
      console.error(e)
      setShowMultiLoginError(true)
    }
  }

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Checking authentication…</p>
        </div>
      </div>
    )
  }

  // Not signed in → show button
  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to CivicTech for Schools</CardTitle>
            <CardDescription>Sign in with your Google account to create classroom attachments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showMultiLoginError && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  We couldn’t confirm you with the Google account Classroom is using.
                  Please sign out of other Google accounts or open Classroom in an incognito window, then try again.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button className="w-full" variant="outline" onClick={handleCognitoSignIn} aria-label="Sign in with Google via Cognito">
                Continue with Google
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By signing in, you agree to our{" "}
                <a href="/terms-of-service" target="_blank" className="text-emerald-600 hover:underline" rel="noreferrer">Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy-policy" target="_blank" className="text-emerald-600 hover:underline" rel="noreferrer">Privacy Policy</a>.
              </p>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs">
                This add-on uses Google SSO via AWS Cognito. We’ll only prompt if the signed-in Classroom user doesn’t match your current session.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Signed in → show form
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex items-center gap-3">
            {user?.picture && <img src={user.picture || "/placeholder.svg"} alt={user?.name || "User"} className="h-8 w-8 rounded-full" />}
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>

        <AttachmentForm />
      </div>
    </div>
  )
}