import { randomBytes } from "node:crypto";
import { saveTokens } from "./token-store.js";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_PROFILE_URL = "https://api.linkedin.com/v2/userinfo";
// Scopes for reading + posting
// Note: r_mailbox (DMs) requires LinkedIn partnership approval
const SCOPES = "openid profile r_basicprofile r_member_social w_member_social";

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Generate the LinkedIn authorization URL.
 * The user opens this URL in their browser to authorize the app.
 */
export function generateAuthUrl(config: LinkedInOAuthConfig): string {
  const state = randomBytes(16).toString("hex");

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
 * Exchange an authorization code for an access token, fetch the member's
 * person URN, and store the credentials. Used after the user manually
 * copies the code from the callback page.
 */
export async function exchangeCode(
  code: string,
  config: LinkedInOAuthConfig,
): Promise<{ success: boolean; personUrn?: string; error?: string }> {
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
    return {
      success: false,
      error: `Token exchange failed (${tokenResponse.status}): ${errBody}`,
    };
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };

  // Fetch the member's person URN via OIDC userinfo
  const profileResponse = await fetch(LINKEDIN_PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileResponse.ok) {
    const errBody = await profileResponse.text();
    return {
      success: false,
      error: `Profile fetch failed (${profileResponse.status}): ${errBody}`,
    };
  }

  const profileData = (await profileResponse.json()) as { sub: string };
  const personUrn = `urn:li:person:${profileData.sub}`;

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

  return { success: true, personUrn };
}
