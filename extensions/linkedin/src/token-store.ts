import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export interface LinkedInTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
  personUrn?: string; // Made optional since we can't always fetch it
}

const TOKEN_FILE = join(homedir(), ".openclaw", "credentials", "linkedin.json");

const EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function saveTokens(tokens: LinkedInTokens): Promise<void> {
  await mkdir(dirname(TOKEN_FILE), { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export async function loadTokens(): Promise<LinkedInTokens | null> {
  try {
    const raw = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as LinkedInTokens;
  } catch {
    return null;
  }
}

/**
 * Get valid access token. Returns token and optional person URN.
 * If person URN was not fetched during OAuth (due to API permissions),
 * we still return the token so posting works (LinkedIn will infer author).
 */
export async function getValidToken(): Promise<{
  token: string;
  personUrn?: string; // Made optional since we can't always fetch it
  warning?: string;
} | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  const now = Date.now();
  if (now >= tokens.expiresAt) return null;

  const result: { token: string; personUrn?: string; warning?: string } = {
    token: tokens.accessToken,
  };

  const remaining = tokens.expiresAt - now;
  if (remaining < EXPIRY_WARNING_MS) {
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    result.warning = `LinkedIn token expires in ${days} day(s). Run \`openclaw linkedin-auth\` to re-authenticate.`;
  }

  // Only include person URN if it was successfully fetched
  if (tokens.personUrn && !tokens.personUrn.startsWith('unknown')) {
    result.personUrn = tokens.personUrn;
  }

  return result;
}