import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  generateAuthUrl,
  exchangeCode,
  type LinkedInOAuthConfig,
} from "./src/oauth-callback.js";
import { postText, postArticle, postImage } from "./src/linkedin-client.js";
import { getValidToken } from "./src/token-store.js";

function getOAuthConfig(pluginConfig: Record<string, unknown>): LinkedInOAuthConfig {
  return {
    clientId: pluginConfig.clientId as string,
    clientSecret: pluginConfig.clientSecret as string,
    redirectUri:
      (pluginConfig.redirectUri as string) ??
      "https://kinokoholic.com/linkedin/callback",
  };
}

const plugin = {
  id: "linkedin",
  name: "LinkedIn",
  description: "LinkedIn content posting tool — post text, articles, and images to your LinkedIn profile",
  configSchema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      clientId: { type: "string" as const },
      clientSecret: { type: "string" as const },
      redirectUri: {
        type: "string" as const,
        default: "https://kinokoholic.com/linkedin/callback",
      },
    },
    required: ["clientId", "clientSecret"],
  },

  register(api: OpenClawPluginApi) {
    const config = api.config as Record<string, unknown>;
    const oauthConfig = getOAuthConfig(config);

    // ── CLI commands: openclaw linkedin-auth / linkedin-status ───
    api.registerCli(
      ({ program }) => {
        program
          .command("linkedin-auth")
          .description("Authenticate with LinkedIn (one-time OAuth setup)")
          .option("--code <code>", "Authorization code from the callback page")
          .action(async (opts: { code?: string }) => {
            if (opts.code) {
              // Step 2: Exchange the pasted code for a token
              console.log("\nExchanging authorization code...");
              const result = await exchangeCode(opts.code.trim(), oauthConfig);
              if (result.success) {
                console.log(`\n✅ LinkedIn connected! (${result.personUrn})`);
                console.log("You can now use /linkedin from any channel to post.\n");
              } else {
                console.error(`\n❌ ${result.error}\n`);
              }
              return;
            }

            // Step 1: Show the auth URL
            const url = generateAuthUrl(oauthConfig);
            console.log("\n🔗 Step 1: Open this URL in your browser:\n");
            console.log(`  ${url}\n`);
            console.log("🔗 Step 2: After authorizing, copy the code from the callback page.\n");
            console.log("🔗 Step 3: Run this command with the code:\n");
            console.log("  openclaw linkedin-auth --code=PASTE_CODE_HERE\n");
          });

        program
          .command("linkedin-status")
          .description("Check LinkedIn authentication status")
          .action(async () => {
            const auth = await getValidToken();
            if (!auth) {
              console.log("❌ Not authenticated. Run `openclaw linkedin-auth` to connect.");
              return;
            }
            console.log(`✅ LinkedIn connected (${auth.personUrn})`);
            if (auth.warning) console.log(`⚠️  ${auth.warning}`);
          });
      },
      { commands: ["linkedin-auth", "linkedin-status"] },
    );

    // ── Auto-reply command: /linkedin ─────────────────────────────
    api.registerCommand({
      name: "linkedin",
      description:
        "Post to LinkedIn. Usage: /linkedin <text> | /linkedin url:<url> <text> | /linkedin image:<path> <text>",
      handler: async (ctx) => {
        const body = (ctx.commandBody ?? "").trim();

        if (!body) {
          return {
            text: "Usage:\n• `/linkedin Hello world!` — text post\n• `/linkedin url:https://example.com Great read!` — share article\n• `/linkedin image:/path/to/img.jpg Check this out` — share image\n• `/linkedin visibility:connections Just for my network` — connections-only",
          };
        }

        // Parse optional flags
        let visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC";
        let remaining = body;

        const visMatch = remaining.match(/^visibility:(public|connections)\s+/i);
        if (visMatch) {
          visibility = visMatch[1]!.toUpperCase() as "PUBLIC" | "CONNECTIONS";
          remaining = remaining.slice(visMatch[0].length);
        }

        // Article share
        const urlMatch = remaining.match(/^url:(\S+)\s+([\s\S]+)/);
        if (urlMatch) {
          const result = await postArticle(
            urlMatch[2]!.trim(),
            urlMatch[1]!,
            undefined,
            undefined,
            visibility,
          );
          return formatResult(result, "article");
        }

        // Image share
        const imgMatch = remaining.match(/^image:(\S+)\s+([\s\S]+)/);
        if (imgMatch) {
          const result = await postImage(
            imgMatch[2]!.trim(),
            imgMatch[1]!,
            undefined,
            undefined,
            visibility,
          );
          return formatResult(result, "image");
        }

        // Text post
        const result = await postText(remaining, visibility);
        return formatResult(result, "text");
      },
    });
  },
};

function formatResult(
  result: { success: boolean; postId?: string; error?: string; warning?: string },
  type: string,
): { text: string } {
  if (!result.success) {
    return { text: `❌ LinkedIn ${type} post failed: ${result.error}` };
  }
  let msg = `✅ LinkedIn ${type} post published!`;
  if (result.postId) msg += `\nPost ID: ${result.postId}`;
  if (result.warning) msg += `\n⚠️ ${result.warning}`;
  return { text: msg };
}

export default plugin;
