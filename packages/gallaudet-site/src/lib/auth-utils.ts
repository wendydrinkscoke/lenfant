import { getRuntimeConfig } from "./environment-utils";

export type ClassroomRole = "teacher" | "student";
export type AuthRole = ClassroomRole | "developer";

const ROLE_PATTERNS: Array<{ role: AuthRole; test: (path: string) => boolean }> = [
  { role: "teacher", test: (path) => path.startsWith("/create-attachment") },
  { role: "teacher", test: (path) => path.startsWith("/teacher-task-view") },
  { role: "teacher", test: (path) => path.startsWith("/student-work-review") },
  { role: "teacher", test: (path) => path.startsWith("/link-upgrade") },
  { role: "student", test: (path) => path.startsWith("/student-task-view") },
  { role: "developer", test: (path) => path.startsWith("/create") },
  { role: "developer", test: (path) => path.startsWith("/developer") },
  { role: "developer", test: (path) => path.startsWith("/partner-with-us") },
];

export function inferUserRoleFromLocation(loc: Location = window.location): AuthRole {
  const trimmedPath = loc.pathname.replace(/\/+$/, "") || "/";

  const match = ROLE_PATTERNS.find(({ test }) => test(trimmedPath));
  if (match) {
    return match.role;
  }

  return "developer";
}

export function inferClassroomRoleFromLocation(loc: Location = window.location): ClassroomRole {
  const role = inferUserRoleFromLocation(loc);
  if (role === "developer") {
    throw new Error(`Unsupported Classroom iframe path: ${loc.pathname}`);
  }
  return role;
}

export interface StartCognitoOAuthFlowOptions {
  loginHint?: string;
  includeRobloxAssociation?: boolean;
  roleOverride?: AuthRole;
  postAuthRedirectPath: string;
}

export interface PopupAuthFlowContext {
  role: AuthRole;
  loginHint?: string;
  includeRobloxAssociation: boolean;
  postAuthRedirectPath: string;
}

interface StoredPopupAuthFlowContext extends PopupAuthFlowContext {
  createdAt: number;
}

const POPUP_AUTH_FLOW_STORAGE_PREFIX = "cognito_popup_auth_flow:";
const POPUP_AUTH_FLOW_MAX_AGE_MS = 1000 * 60 * 30;

const getPopupAuthFlowStorageKey = (flowId: string): string =>
  `${POPUP_AUTH_FLOW_STORAGE_PREFIX}${flowId}`;

const pruneExpiredPopupAuthFlows = () => {
  const now = Date.now();
  for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = window.sessionStorage.key(i);
    if (!key || !key.startsWith(POPUP_AUTH_FLOW_STORAGE_PREFIX)) {
      continue;
    }

    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
      window.sessionStorage.removeItem(key);
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredPopupAuthFlowContext>;
      if (
        typeof parsed.createdAt !== "number" ||
        now - parsed.createdAt > POPUP_AUTH_FLOW_MAX_AGE_MS
      ) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      window.sessionStorage.removeItem(key);
    }
  }
};

const generatePopupAuthFlowId = (): string => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

export function createPopupAuthFlowContext(
  context: PopupAuthFlowContext,
): string {
  pruneExpiredPopupAuthFlows();

  const flowId = generatePopupAuthFlowId();
  const payload: StoredPopupAuthFlowContext = {
    ...context,
    createdAt: Date.now(),
  };

  window.sessionStorage.setItem(
    getPopupAuthFlowStorageKey(flowId),
    JSON.stringify(payload),
  );

  return flowId;
}

export function getPopupAuthFlowContext(
  flowId: string,
): PopupAuthFlowContext | null {
  pruneExpiredPopupAuthFlows();

  const storageKey = getPopupAuthFlowStorageKey(flowId);
  const rawValue = window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredPopupAuthFlowContext>;
    if (
      parsed.role !== "teacher" &&
      parsed.role !== "student" &&
      parsed.role !== "developer"
    ) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    if (
      typeof parsed.postAuthRedirectPath !== "string" ||
      parsed.postAuthRedirectPath.length === 0
    ) {
      window.sessionStorage.removeItem(storageKey);
      return null;
    }

    return {
      role: parsed.role,
      loginHint:
        typeof parsed.loginHint === "string" ? parsed.loginHint : undefined,
      includeRobloxAssociation: Boolean(parsed.includeRobloxAssociation),
      postAuthRedirectPath: parsed.postAuthRedirectPath,
    };
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

export function clearPopupAuthFlowContext(flowId: string): void {
  window.sessionStorage.removeItem(getPopupAuthFlowStorageKey(flowId));
}

export function startCognitoOAuthFlowViaPopup(
  options: StartCognitoOAuthFlowOptions,
) {
  const role: AuthRole = options.roleOverride ?? inferUserRoleFromLocation();
  const params = new URLSearchParams({
    role,
    postAuthRedirectPath: options.postAuthRedirectPath,
  });
  if (options.loginHint) {
    params.set("login_hint", options.loginHint);
  }
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
