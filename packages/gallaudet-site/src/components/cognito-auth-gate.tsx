import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { AuthUser, useAuth } from "../hooks/use-auth";
import { startCognitoOAuthFlowViaPopup } from "../lib/auth-utils";

type CognitoAuthGateContext = {
  user: AuthUser | null;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
};

type CognitoAuthGateProps = {
  loginHint?: string;
  roleOverride?: "developer" | "teacher" | "student";
  children: ReactNode | ((ctx: CognitoAuthGateContext) => ReactNode);
};

const renderChildren = (
  children: CognitoAuthGateProps["children"],
  context: CognitoAuthGateContext,
) => {
  return typeof children === "function"
    ? (children as (ctx: CognitoAuthGateContext) => ReactNode)(context)
    : children;
};

export function CognitoAuthGate({ loginHint, roleOverride, children }: CognitoAuthGateProps) {
  const { user, isSignedIn, checkAuth, signOut } = useAuth();
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [showMultiLoginError, setShowMultiLoginError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsCheckingAuth(true);
      try {
        await checkAuth(loginHint);
        if (!cancelled) {
          setShowMultiLoginError(false);
        }
      } catch (error: any) {
        if (!cancelled && error?.code === "LOGIN_HINT_MISMATCH") {
          setShowMultiLoginError(true);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingAuth(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkAuth, loginHint]);

  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type !== "cognito-auth-complete") return;

      setIsCheckingAuth(true);
      try {
        if (ev.data?.ok) {
          if (ev.data.idToken)
            window.localStorage.setItem("id_token", ev.data.idToken);
          if (ev.data.accessToken)
            window.localStorage.setItem("access_token", ev.data.accessToken);
          if (ev.data.refreshToken)
            window.localStorage.setItem("refresh_token", ev.data.refreshToken);

          await checkAuth(loginHint);
          setShowMultiLoginError(false);
        } else {
          setShowMultiLoginError(true);
        }
      } catch (error: any) {
        if (error?.code === "LOGIN_HINT_MISMATCH") {
          setShowMultiLoginError(true);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkAuth, loginHint]);

  const handleCognitoSignIn = () => {
    try {
      const postAuthRedirectPath =
        `${window.location.pathname}${window.location.search}${window.location.hash}`;
      startCognitoOAuthFlowViaPopup({
        loginHint,
        roleOverride,
        postAuthRedirectPath,
      });
    } catch (error: any) {
      if (error?.message !== "POPUP_BLOCKED") {
        console.error(error);
      }
      setShowMultiLoginError(true);
    }
  };

  const context = useMemo<CognitoAuthGateContext>(
    () => ({
      user,
      isSignedIn,
      signOut,
    }),
    [isSignedIn, signOut, user],
  );

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">
            Checking your Classroom session…
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>
              Use your Google account so we can securely load your Classroom data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showMultiLoginError && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  We couldn’t confirm you with the Google account Classroom is using.
                  Please sign out of other Google accounts or open Classroom in an
                  incognito window, then try again.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleCognitoSignIn}
                aria-label="Sign in with Google via Cognito"
              >
                Continue with Google
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By signing in, you agree to our{" "}
                <a
                  href="/terms-of-service"
                  target="_blank"
                  className="text-emerald-600 hover:underline"
                  rel="noreferrer"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  className="text-emerald-600 hover:underline"
                  rel="noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs">
                We only use your Google login to confirm you’re allowed to access this
                Classroom content.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{renderChildren(children, context)}</>;
}
