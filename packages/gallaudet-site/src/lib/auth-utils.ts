import { getRuntimeConfig } from "./environment-utils";

export type ClassroomRole = "teacher" | "student";

const ROLE_PATTERNS: Array<{ role: ClassroomRole; test: (path: string) => boolean }> = [
  { role: "teacher", test: (path) => path.startsWith("/create-attachment") },
  { role: "teacher", test: (path) => path.startsWith("/teacher-task-view") },
  { role: "teacher", test: (path) => path.startsWith("/student-work-review") },
  { role: "teacher", test: (path) => path.startsWith("/link-upgrade") },
  { role: "student", test: (path) => path.startsWith("/student-task-view") },
];

export function inferClassroomRoleFromLocation(loc: Location = window.location): ClassroomRole {
  const trimmedPath = loc.pathname.replace(/\/+$/, "") || "/";
  const match = ROLE_PATTERNS.find(({ test }) => test(trimmedPath));
  if (!match) {
    throw new Error(`Unsupported Classroom iframe path: ${trimmedPath}`);
  }
  return match.role;
}

export interface StartCognitoOAuthFlowOptions {
  loginHint?: string;
  includeRobloxAssociation?: boolean;
  roleOverride?: ClassroomRole;
}

export function startCognitoOAuthFlowViaPopup(
  optionsOrLoginHint?: string | StartCognitoOAuthFlowOptions,
) {
  const options: StartCognitoOAuthFlowOptions =
    typeof optionsOrLoginHint === "string" || typeof optionsOrLoginHint === "undefined"
      ? { loginHint: optionsOrLoginHint }
      : optionsOrLoginHint;

  const role = options.roleOverride ?? inferClassroomRoleFromLocation();
  const params = new URLSearchParams({ role });
  if (options.loginHint) params.set("login_hint", options.loginHint);
  if (options.includeRobloxAssociation) {
    params.set("includeRobloxAssociation", "1");
  }
  const url = `${window.location.origin}/auth/popup-start?${params}`;
  return window.open(url, "cognitoLogin", "width=520,height=640");
}

/**
 * Exchanges a Cognito authorization code (from the redirect) for tokens.
 * Returns the ID token on success and stores tokens in localStorage.
 * Throws an Error on failure.
 */
export interface CognitoTokenSet {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
}

export async function exchangeCognitoRedirectCodeForCognitoTokens(
  code: string,
): Promise<CognitoTokenSet> {
  const runtimeConfig = await getRuntimeConfig();
  const clientId = runtimeConfig.userPoolWebClientId;
  const domainPrefix = runtimeConfig.cognitoDomainPrefix;
  const domain = `https://${domainPrefix}.auth.us-east-1.amazoncognito.com`;
  const redirectUri = `${window.location.origin}/cognito/popup-callback`;

  const codeVerifier = localStorage.getItem("cognito_pkce_code_verifier");
  if (!codeVerifier) throw new Error("Missing PKCE code_verifier");

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    let msg = "Failed to exchange code for token";
    try { msg += `: ${await resp.text()}`; } catch {}
    throw new Error(msg);
  }

  const data: { id_token: string; access_token: string; refresh_token?: string } = await resp.json();
  localStorage.removeItem("cognito_pkce_code_verifier");
  if (!data.id_token || !data.access_token) {
    throw new Error("Cognito response missing required tokens");
  }

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? undefined,
  };
}
