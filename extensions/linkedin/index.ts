import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  generateAuthUrl,
  exchangeCode,
  type LinkedInOAuthConfig,
} from "./src/oauth-callback.js";
import { postText, postArticle, postImage, getProfile, getMyPosts, getPostEngagement } from "./src/linkedin-client.js";
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

    // ── Reading command: /linkedin-profile ────────────────────────
    api.registerCommand({
      name: "linkedin-profile",
      description: "Get your LinkedIn profile information",
      handler: async () => {
        const result = await getProfile();
        if (!result.success || !result.profile) {
          return { text: `❌ ${result.error}` };
        }
        const p = result.profile;
        return {
          text: `**LinkedIn Profile**\n• Name: ${p.firstName} ${p.lastName}\n• ID: ${p.id}${p.headline ? `\n• Headline: ${p.headline}` : ""}`,
        };
      },
    });

    // ── Reading command: /linkedin-posts ──────────────────────────
    api.registerCommand({
      name: "linkedin-posts",
      description: "List your recent LinkedIn posts with engagement",
      handler: async (ctx) => {
        const count = parseInt(ctx.commandBody?.trim() || "5", 10) || 5;
        const result = await getMyPosts(Math.min(count, 10));

        if (!result.success || !result.posts) {
          return { text: `❌ ${result.error}` };
        }

        if (result.posts.length === 0) {
          return { text: "No posts found." };
        }

        let text = `**Recent LinkedIn Posts** (${result.posts.length})\n\n`;
        for (const post of result.posts) {
          const preview = post.text.slice(0, 100) + (post.text.length > 100 ? "..." : "");
          const date = post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "Unknown date";
          text += `• **${date}** — ${preview}\n`;
          text += `  ID: \`${post.id}\`\n\n`;
        }
        text += "Use `/linkedin-engagement <post-id>` to get detailed engagement data.";
        return { text };
      },
    });

    // ── Reading command: /linkedin-engagement ─────────────────────
    api.registerCommand({
      name: "linkedin-engagement",
      description: "Get engagement details for a specific LinkedIn post",
      handler: async (ctx) => {
        const postUrn = ctx.commandBody?.trim();
        if (!postUrn) {
          return { text: "Usage: `/linkedin-engagement <post-urn-or-id>`" };
        }

        const result = await getPostEngagement(postUrn);

        if (!result.success) {
          return { text: `❌ ${result.error}` };
        }

        let text = "**📊 Post Engagement**\n\n";
        text += `• **Likes**: ${result.engagement?.likes || 0}\n`;
        text += `• **Comments**: ${result.engagement?.comments || 0}\n`;
        text += `• **Shares**: ${result.engagement?.shares || 0}\n`;

        if (result.comments && result.comments.length > 0) {
          text += `\n**Recent Comments** (${result.comments.length})\n\n`;
          for (const c of result.comments.slice(0, 5)) {
            const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "";
            text += `• **${c.authorName}**${c.authorHeadline ? ` (${c.authorHeadline})` : ""}\n`;
            text += `  "${c.text.slice(0, 150)}${c.text.length > 150 ? "..." : ""}"\n`;
            text += `  ${date} • ${c.likes} likes\n\n`;
          }
        }

        return { text };
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
