/**
 * channel.ts — OpenClaw Discord channel plugin
 *
 * Architecture
 * ────────────
 * Each Discord channel maps to a dedicated OpenClaw session context key.
 * Messages are routed to the OpenClaw HTTP gateway (port 18789), which
 * forwards them to the main agent and streams the response back.
 * The bot replies in the same Discord channel, using thread mode for
 * multi-message replies so the channel stays readable.
 *
 * Channel routing
 * ───────────────
 *   #general    → agent:main:discord:general    (daily tasks, Q&A)
 *   #summaries  → agent:main:discord:summaries  (URL/YouTube processing)
 *   #moltbook   → agent:main:discord:moltbook   (Moltbook cron output)
 *   #biz_ideas  → agent:main:discord:biz_ideas  (research & plans)
 *   #monitoring → BOT-POST ONLY, no user routing
 *   #briefing   → BOT-POST ONLY, no user routing
 *
 * Configuration (openclaw.json channels.discord)
 * ───────────────────────────────────────────────
 * {
 *   "enabled": true,
 *   "botToken": "<DISCORD_BOT_TOKEN>",
 *   "guildId": "<DISCORD_SERVER_ID>",
 *   "gatewayUrl": "http://127.0.0.1:18789",
 *   "gatewayToken": "dev-token",
 *   "agentId": "main",
 *   "channels": {
 *     "general":    "<channel-id>",
 *     "summaries":  "<channel-id>",
 *     "moltbook":   "<channel-id>",
 *     "biz_ideas":  "<channel-id>",
 *     "monitoring": "<channel-id>",
 *     "briefing":   "<channel-id>"
 *   },
 *   "postOnlyChannels": ["monitoring", "briefing"],
 *   "dmPolicy": "allowlist",
 *   "allowFrom": ["<your-discord-user-id>"]
 * }
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  ThreadChannel,
  TextChannel,
  MessageFlags,
  type ClientOptions,
} from "discord.js";
import { setPostClient } from "./post.js";
import { getDiscordRuntime } from "./runtime.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscordChannelConfig {
  enabled: boolean;
  botToken: string;
  guildId: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  agentId?: string;
  channels: Record<string, string>;        // channelName → discordChannelId
  postOnlyChannels?: string[];             // channel names the bot posts to but doesn't read from
  dmPolicy?: "allowlist" | "open";
  allowFrom?: string[];                    // Discord user IDs permitted to send messages
}

// ─── Session key helper ───────────────────────────────────────────────────────

function sessionKeyForChannel(channelName: string, agentId: string): string {
  return `agent:${agentId}:discord:${channelName}`;
}

// ─── Gateway call ─────────────────────────────────────────────────────────────

interface GatewayTurnRequest {
  sessionKey: string;
  message: string;
  userId: string;
  channelName: string;
}

interface GatewayTurnResponse {
  text: string;
  sessionKey: string;
}

async function callGateway(
  cfg: DiscordChannelConfig,
  req: GatewayTurnRequest,
): Promise<GatewayTurnResponse> {
  const base = cfg.gatewayUrl ?? "http://127.0.0.1:18789";
  const agentId = cfg.agentId ?? "main";
  const token = cfg.gatewayToken ?? "dev-token";

  const url = `${base}/agents/${agentId}/chat`;

  const body = {
    message: req.message,
    sessionKey: req.sessionKey,
    metadata: {
      channel: "discord",
      channelName: req.channelName,
      userId: req.userId,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "(no body)");
    throw new Error(`OpenClaw gateway error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { text?: string; sessionKey?: string };
  return {
    text: data.text ?? "(no response)",
    sessionKey: req.sessionKey,
  };
}

// ─── Message chunker ──────────────────────────────────────────────────────────

const MAX_DISCORD_LENGTH = 1990;

function chunkMessage(text: string): string[] {
  if (text.length <= MAX_DISCORD_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_DISCORD_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf("\n", MAX_DISCORD_LENGTH);
    if (cut < MAX_DISCORD_LENGTH / 2) cut = MAX_DISCORD_LENGTH;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return chunks;
}

// ─── Allowlist check ──────────────────────────────────────────────────────────

function isAllowed(userId: string, cfg: DiscordChannelConfig): boolean {
  if (cfg.dmPolicy === "open") return true;
  return (cfg.allowFrom ?? []).includes(userId);
}

// ─── Reverse channel lookup ───────────────────────────────────────────────────

function channelNameForId(
  discordChannelId: string,
  cfg: DiscordChannelConfig,
): string | null {
  for (const [name, id] of Object.entries(cfg.channels)) {
    if (id === discordChannelId) return name;
  }
  return null;
}

// ─── Discord client init ──────────────────────────────────────────────────────

let activeClient: Client | null = null;

export async function startDiscordBot(cfg: DiscordChannelConfig): Promise<Client> {
  const opts: ClientOptions = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  };

  const client = new Client(opts);
  activeClient = client;

  const postOnlySet = new Set(cfg.postOnlyChannels ?? []);
  const agentId = cfg.agentId ?? "main";

  client.on("ready", () => {
    console.log(`[discord] Logged in as ${client.user?.tag}`);
    setPostClient(client, cfg.channels);
  });

  client.on("messageCreate", async (message: Message) => {
    // Ignore bot messages (including our own)
    if (message.author.bot) return;

    // Only handle messages in the configured guild
    if (message.guildId !== cfg.guildId) return;

    // Resolve channel name from ID
    const channelId = message.channelId;
    const channelName = channelNameForId(channelId, cfg);

    // Ignore messages in channels we don't know about
    if (!channelName) return;

    // Post-only channels: bot posts here, users cannot trigger agent
    if (postOnlySet.has(channelName)) return;

    // Allowlist check
    if (!isAllowed(message.author.id, cfg)) {
      await message.react("🚫").catch(() => null);
      return;
    }

    // Ignore empty messages
    const text = message.content.trim();
    if (!text) return;

    // Show typing indicator
    const channel = message.channel;
    if (channel instanceof TextChannel || channel instanceof ThreadChannel) {
      await channel.sendTyping().catch(() => null);
    }

    const sessionKey = sessionKeyForChannel(channelName, agentId);

    let responseText: string;
    try {
      const result = await callGateway(cfg, {
        sessionKey,
        message: text,
        userId: message.author.id,
        channelName,
      });
      responseText = result.text;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[discord] Gateway error in #${channelName}:`, errMsg);
      await message.reply(`⚠️ OpenClaw error: ${errMsg}`).catch(() => null);
      return;
    }

    // Send response, chunking if needed
    const chunks = chunkMessage(responseText);
    const isLong = chunks.length > 1;

    if (isLong && channel instanceof TextChannel) {
      // Create a thread to keep long replies organised
      let thread: ThreadChannel;
      try {
        thread = await channel.threads.create({
          name: `${message.author.username} — ${new Date().toISOString().slice(0, 10)}`,
          autoArchiveDuration: 60,
          startMessage: message,
        });
      } catch {
        // Fall back to plain replies if thread creation fails
        for (const chunk of chunks) {
          await message.reply(chunk).catch(() => null);
        }
        return;
      }
      for (const chunk of chunks) {
        await thread.send(chunk).catch(() => null);
      }
    } else {
      for (const chunk of chunks) {
        await message.reply(chunk).catch(() => null);
      }
    }
  });

  await client.login(cfg.botToken);
  return client;
}

export function getActiveDiscordClient(): Client | null {
  return activeClient;
}

export async function stopDiscordBot(): Promise<void> {
  if (activeClient) {
    await activeClient.destroy();
    activeClient = null;
    console.log("[discord] Bot stopped");
  }
}
