import { useEffect, useState } from "react";
import { getGallaudetApi } from "../lib/gallaudet-api";
import { getRuntimeConfig } from "../lib/environment-utils";
import { generateCodeChallenge, generateCodeVerifier } from "../lib/pkce-utils";

const toB64Url = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

export default function GooglePopupCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) throw new Error("Missing Google code");
        const codeVerifier = localStorage.getItem("google_pkce_verifier");
        if (!codeVerifier) throw new Error("Missing PKCE verifier");

        const rawState = url.searchParams.get("state");
        const stateParams = rawState ? new URLSearchParams(rawState) : null;
        const includeRobloxAssociation =
          stateParams?.get("includeRobloxAssociation") === "1";
        const roleParam = stateParams?.get("role");
        const role =
          roleParam === "teacher" || roleParam === "student" || roleParam === "developer"
            ? roleParam
            : undefined;
        const loginHint = stateParams?.get("login_hint") ?? undefined;

        const client = await getGallaudetApi();
        await client.delegateGoogleClassroomAccess({
          delegateGoogleClassroomAccessRequestContent: {
            code,
            code_verifier: codeVerifier,
            redirect_uri: `${window.location.origin}/google/popup-callback`,
          },
        });
        localStorage.removeItem("google_pkce_verifier");

        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { type: "google-oauth-scopes-received" },
            window.location.origin,
          );
        }

        if (includeRobloxAssociation) {
          const runtimeConfig = await getRuntimeConfig();
          const clientId = runtimeConfig.userPoolWebClientId;
          const domainPrefix = runtimeConfig.cognitoDomainPrefix;
          const domain = `https://${domainPrefix}.auth.us-east-1.amazoncognito.com`;
          const redirectUri = `${window.location.origin}/cognito/popup-callback`;

          const robloxVerifier = generateCodeVerifier();
          const robloxChallenge = await generateCodeChallenge(robloxVerifier);
          localStorage.setItem("cognito_pkce_code_verifier", robloxVerifier);

          const stateObj = {
            role: role ?? "student",
            login_hint: loginHint,
            includeRobloxAssociation: true,
            stage: "roblox" as const,
          };
          const robloxState = toB64Url(JSON.stringify(stateObj));

          const robloxParams = new URLSearchParams({
            client_id: clientId,
            response_type: "code",
            scope: "openid email profile",
            redirect_uri: redirectUri,
            code_challenge: robloxChallenge,
            code_challenge_method: "S256",
            identity_provider: "RobloxOIDC",
            state: robloxState,
          });

          window.location.replace(`${domain}/oauth2/authorize?${robloxParams}`);
          return;
        }

        const idToken = localStorage.getItem("cognito_id_token");
        const accessToken = localStorage.getItem("access_token");
        const refreshToken = localStorage.getItem("refresh_token");
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            {
              type: "cognito-auth-complete",
              ok: true,
              role,
              idToken,
              accessToken,
              refreshToken,
            },
            window.location.origin,
          );
          window.close();
        } else {
          // Fallback if opened directly
          window.location.replace("/create-attachment");
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Google OAuth error");
        if (window.opener && window.opener !== window) {
          window.opener.postMessage({ type: "cognito-auth-complete", ok: false, error: String(e) }, window.location.origin);
        }
      }
    })();
  }, []);

  return <div style={{display:'grid',placeItems:'center',height:'100vh'}}>{error ? <p style={{ color: "#b91c1c" }}>{error}</p> : <p>Securing Classroom access…</p>}</div>;
}
