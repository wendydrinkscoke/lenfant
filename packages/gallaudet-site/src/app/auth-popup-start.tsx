import { useEffect } from "react";
import { generateCodeChallenge, generateCodeVerifier } from "../lib/pkce-utils";
import { getRuntimeConfig } from "../lib/environment-utils";
import {
  createPopupAuthFlowContext,
  getPopupAuthFlowContext,
} from "../lib/auth-utils";

// simple base64url helpers (avoid +,/ and =)
const toB64Url = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

export default function AuthPopupStart() {
  useEffect(() => {
    (async () => {
      const rc = await getRuntimeConfig();
      const clientId = rc.userPoolWebClientId;
      const domainPrefix = rc.cognitoDomainPrefix;
      const domain = `https://${domainPrefix}.auth.us-east-1.amazoncognito.com`;

      const url = new URL(window.location.href);
      const loginHint = url.searchParams.get("login_hint") ?? undefined;
      const roleParam = url.searchParams.get("role");
      const includeRobloxAssociation =
        url.searchParams.get("includeRobloxAssociation") === "1";
      const postAuthRedirectPath =
        url.searchParams.get("postAuthRedirectPath") ?? undefined;

      if (!roleParam || !postAuthRedirectPath) {
        throw new Error("Missing required parameters");
      }

      if (
        roleParam !== "teacher" &&
        roleParam !== "student" &&
        roleParam !== "developer"
      ) {
        throw new Error(`Invalid role parameter: ${roleParam}`);
      }

      const flowId = createPopupAuthFlowContext({
        role: roleParam,
        loginHint,
        includeRobloxAssociation,
        postAuthRedirectPath,
      });

      const flowContext = getPopupAuthFlowContext(flowId);
      if (!flowContext) {
        throw new Error("Missing or expired sign-in flow");
      }

      // Generate PKCE **in the popup**
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      localStorage.setItem("cognito_pkce_code_verifier", codeVerifier);

      // IMPORTANT: redirect_uri must match the callback URL exactly (no query)
      const redirectUri = `${window.location.origin}/cognito/popup-callback`;

      // Put your app's state into the OAuth 'state' param
      const stateObj = {
        flow: flowId,
        stage: "google" as const,
      };
      const state = toB64Url(JSON.stringify(stateObj));

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        scope: "openid email profile",
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        identity_provider: "Google",
      });
      if (flowContext.loginHint) {
        params.set("login_hint", flowContext.loginHint);
      }

      const authUrl = `${domain}/oauth2/authorize?${params}`;
      window.location.replace(authUrl);
    })();
  }, []);

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      Starting sign-in…
    </div>
  );
}
