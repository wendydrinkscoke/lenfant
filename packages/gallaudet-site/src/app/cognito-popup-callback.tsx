import { useEffect, useState } from "react";
import { exchangeCognitoRedirectCodeForCognitoTokens } from "../lib/auth-utils";
import { getGoogleAuthClientID } from "../lib/environment-utils";
import { getGallaudetApi } from "../lib/gallaudet-api";
import { generateCodeChallenge, generateCodeVerifier } from "../lib/pkce-utils";

// base64url helpers
const fromB64Url = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
};

export default function CognitoPopupCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // 1) Parse OAuth params from Hosted UI
        const code = url.searchParams.get("code");
        if (!code) throw new Error("Missing code");

        // 2) Recover app context from 'state'
        const rawState = url.searchParams.get("state");
        let parsedState: {
          role?: "teacher" | "student" | "developer";
          login_hint?: string | undefined;
          includeRobloxAssociation?: boolean;
          postAuthRedirectPath?: string;
          stage?: "google" | "roblox";
        } = {};
        if (rawState) {
          try {
            parsedState = JSON.parse(fromB64Url(rawState));
          } catch {
            console.warn("Invalid state parameter: " + rawState);
          }
        }
        const role = parsedState.role;
        const loginHint = parsedState.login_hint;
        const stage = parsedState.stage === "roblox" ? "roblox" : "google";
        const includeRobloxAssociation = Boolean(parsedState.includeRobloxAssociation);
        const postAuthRedirectPath = parsedState.postAuthRedirectPath;
        if (!role) {
          throw new Error("Missing role in state parameter");
        }
        if (!postAuthRedirectPath) {
          throw new Error("Missing postAuthRedirectPath in state parameter");
        }

        if (role !== "teacher" && role !== "student" && role !== "developer") {
          throw new Error(`Invalid role provided: ${role}`);
        }

        const origin = window.location.origin;

        const cognitoTokens =
          await exchangeCognitoRedirectCodeForCognitoTokens(code);

        const completeAuthFlow = (options?: { sendRobloxComplete?: boolean }) => {
          if (window.opener && window.opener !== window) {
            if (options?.sendRobloxComplete) {
              window.opener.postMessage(
                { type: "roblox-sign-in-complete" },
                origin,
              );
            }
            const idToken =
              localStorage.getItem("id_token") ??
              localStorage.getItem("cognito_id_token") ??
              cognitoTokens.idToken;
            const accessToken =
              localStorage.getItem("access_token") ??
              cognitoTokens.accessToken;
            const refreshToken =
              localStorage.getItem("refresh_token") ??
              cognitoTokens.refreshToken;
            window.opener.postMessage(
              {
                type: "cognito-auth-complete",
                ok: true,
                role,
                idToken,
                accessToken,
                refreshToken,
                postAuthRedirectPath,
              },
              origin,
            );
            window.close();
            return;
          }

          window.location.replace(postAuthRedirectPath);
        };

        if (stage === "google") {
          if (window.opener && window.opener !== window) {
            window.opener.postMessage(
              { type: "google-signin-complete" },
              origin,
            );
          }

          localStorage.setItem("cognito_id_token", cognitoTokens.idToken);
          localStorage.setItem("id_token", cognitoTokens.idToken);
          localStorage.setItem("access_token", cognitoTokens.accessToken);
          if (cognitoTokens.refreshToken) {
            localStorage.setItem("refresh_token", cognitoTokens.refreshToken);
          }

          if (role === "developer") {
            completeAuthFlow();
            return;
          }

          const apiClient = await getGallaudetApi();
          let hasDelegatedAccess = false;
          try {
            const status = await apiClient.getGoogleClassroomAccessStatus();
            hasDelegatedAccess = Boolean(status.delegated);
          } catch (statusError) {
            console.warn("Unable to verify Classroom delegation status", statusError);
            // Fall through and force consent to guarantee we capture a refresh token.
          }

          const googleVerifier = generateCodeVerifier();
          const googleChallenge = await generateCodeChallenge(googleVerifier);
          localStorage.setItem("google_pkce_verifier", googleVerifier);

          let googleScope: string;
          switch (role) {
            case "teacher":
              googleScope =
                "https://www.googleapis.com/auth/classroom.addons.teacher";
              break;
            case "student":
              googleScope = [
                "https://www.googleapis.com/auth/classroom.addons.student",
                "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
                "https://www.googleapis.com/auth/classroom.courses.readonly",
              ].join(" ");
              break;
            default: {
              const _exhaustiveRole: never = role;
              throw new Error(
                `Unsupported role for classroom scopes: ${String(_exhaustiveRole)}`,
              );
            }
          }

          const googleParams = new URLSearchParams({
            client_id: getGoogleAuthClientID(),
            redirect_uri: `${window.location.origin}/google/popup-callback`,
            response_type: "code",
            scope: googleScope,
            include_granted_scopes: "true",
            code_challenge_method: "S256",
            code_challenge: googleChallenge,
          });
          if (hasDelegatedAccess) {
            googleParams.set("access_type", "online");
          } else {
            googleParams.set("access_type", "offline");
            googleParams.set("prompt", "consent");
          }
          if (loginHint) googleParams.set("login_hint", loginHint);

          const googleState = new URLSearchParams({
            role,
            includeRobloxAssociation: includeRobloxAssociation ? "1" : "0",
          });
          if (loginHint) {
            googleState.set("login_hint", loginHint);
          }
          googleState.set("postAuthRedirectPath", postAuthRedirectPath);
          googleParams.set("state", googleState.toString());

          window.location.replace(
            `https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`,
          );
          return;
        }

        const apiClient = await getGallaudetApi();
        await apiClient.linkRobloxAccount({
          linkRobloxAccountRequestContent: {
            robloxIdToken: cognitoTokens.idToken,
          },
        });

        // Roblox linking flow complete — notify opener and finish.
        completeAuthFlow({ sendRobloxComplete: true });
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "OAuth error");
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { type: "cognito-auth-complete", ok: false, error: String(e) },
            window.location.origin
          );
        }
      }
    })();
  }, []);

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <p>Finishing sign-in…</p>}
    </div>
  );
}
