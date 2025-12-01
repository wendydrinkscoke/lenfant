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
        let appState: {
          role?: "teacher" | "student";
          login_hint?: string | undefined;
          includeRobloxAssociation?: boolean;
          stage?: "google" | "roblox";
        } = {};
        if (rawState) {
          try {
            appState = JSON.parse(fromB64Url(rawState));
          } catch {
            console.warn("Invalid state parameter: " + rawState);
          }
        }
        const {
          role,
          login_hint: loginHint,
          includeRobloxAssociation: includeRobloxAssociationState,
          stage: stageState,
        } = appState;
        if (!role) {
          throw new Error("Missing role in state parameter");
        }

        if (role !== "teacher" && role !== "student") {
          throw new Error(`Invalid role provided: ${role}`);
        }

        const stage = stageState === "roblox" ? "roblox" : "google";
        const includeRobloxAssociation = Boolean(includeRobloxAssociationState);
        const origin = window.location.origin;

        const cognitoTokens =
          await exchangeCognitoRedirectCodeForCognitoTokens(code);

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

          const googleVerifier = generateCodeVerifier();
          const googleChallenge = await generateCodeChallenge(googleVerifier);
          localStorage.setItem("google_pkce_verifier", googleVerifier);

          const googleScope =
            role === "teacher"
              ? "https://www.googleapis.com/auth/classroom.addons.teacher"
              : [
                  "https://www.googleapis.com/auth/classroom.addons.student",
                  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
                  "https://www.googleapis.com/auth/classroom.courses.readonly"
                ].join(" ");

          const googleParams = new URLSearchParams({
            client_id: getGoogleAuthClientID(),
            redirect_uri: `${window.location.origin}/google/popup-callback`,
            response_type: "code",
            scope: googleScope,
            include_granted_scopes: "true",
            access_type: "offline",
            code_challenge_method: "S256",
            code_challenge: googleChallenge,
          });
          if (loginHint) googleParams.set("login_hint", loginHint);

          const googleState = new URLSearchParams({
            role,
            includeRobloxAssociation: includeRobloxAssociation ? "1" : "0",
          });
          if (loginHint) {
            googleState.set("login_hint", loginHint);
          }
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
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { type: "roblox-sign-in-complete" },
            origin,
          );
          const idToken =
            localStorage.getItem("id_token") ??
            localStorage.getItem("cognito_id_token");
          const accessToken = localStorage.getItem("access_token");
          const refreshToken = localStorage.getItem("refresh_token");
          window.opener.postMessage(
            {
              type: "cognito-auth-complete",
              ok: true,
              role,
              idToken,
              accessToken,
              refreshToken,
            },
            origin,
          );
          window.close();
        } else {
          window.location.replace(
            role === "teacher" ? "/teacher-task-view" : "/student-task-view",
          );
        }
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
