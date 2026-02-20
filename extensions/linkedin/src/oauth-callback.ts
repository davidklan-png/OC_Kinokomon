import { randomBytes } from "node:crypto";
import {
  saveTokens,
  setPendingOAuthState,
  consumePendingOAuthState,
} from "./token-store.js";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_PROFILE_URL = "https://api.linkedin.com/v2/me";
const SCOPES = "openid profile w_member_social";

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Generate the LinkedIn authorization URL and store the CSRF state.
 * The user opens this URL in their browser to authorize the app.
 */
export function generateAuthUrl(config: LinkedInOAuthConfig): string {
  const state = randomBytes(16).toString("hex");
  setPendingOAuthState(state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state,
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle the OAuth callback: validate state, exchange code for token,
 * fetch person URN, and store credentials.
 */
export async function handleOAuthCallback(
  code: string,
  state: string,
  config: LinkedInOAuthConfig,
): Promise<{ success: boolean; error?: string }> {
  const expectedState = consumePendingOAuthState();
  if (!expectedState || state !== expectedState) {
    return { success: false, error: "Invalid or expired OAuth state. Please restart the auth flow." };
  }

  // Exchange authorization code for access token
  const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text();
    return { success: false, error: `Token exchange failed (${tokenResponse.status}): ${errBody}` };
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };

  // Fetch the member's person URN
  const profileResponse = await fetch(LINKEDIN_PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileResponse.ok) {
    const errBody = await profileResponse.text();
    return { success: false, error: `Profile fetch failed (${profileResponse.status}): ${errBody}` };
  }

  const profileData = (await profileResponse.json()) as { id: string };
  const personUrn = `urn:li:person:${profileData.id}`;

  const now = Date.now();
  await saveTokens({
    accessToken: tokenData.access_token,
    expiresAt: now + tokenData.expires_in * 1000,
    refreshToken: tokenData.refresh_token,
    refreshTokenExpiresAt: tokenData.refresh_token_expires_in
      ? now + tokenData.refresh_token_expires_in * 1000
      : undefined,
    personUrn,
  });

  return { success: true };
}

/** HTML page shown to the user after successful OAuth authorization */
export const SUCCESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>LinkedIn Connected</title>
<style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:32px;text-align:center;max-width:400px}
h1{color:#0a66c2;margin-top:0}.ok{color:#24e08a;font-size:48px}</style></head>
<body><div class="card"><div class="ok">&#10003;</div><h1>LinkedIn Connected</h1>
<p>Your LinkedIn account has been linked to OpenClaw. You can close this tab.</p>
<p style="opacity:0.6;font-size:13px">Use <code>/linkedin</code> from any channel to post.</p></div></body></html>`;

/** HTML page shown on OAuth failure */
export function errorHtml(message: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>LinkedIn Auth Error</title>
<style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:32px;text-align:center;max-width:400px}
h1{color:#ff5c5c;margin-top:0}.err{color:#ff5c5c;font-size:48px}</style></head>
<body><div class="card"><div class="err">&#10007;</div><h1>Authentication Failed</h1>
<p>${message}</p>
<p style="opacity:0.6;font-size:13px">Run <code>openclaw linkedin-auth</code> to try again.</p></div></body></html>`;
}
