/**
 * index.ts — OpenClaw Discord plugin entry point
 *
 * Registers the Discord bot as an OpenClaw plugin. The bot connects to Discord
 * via the gateway (WebSocket) on plugin start and disconnects cleanly on stop.
 *
 * Configuration is read from openclaw.json under channels.discord:
 *   botToken        — Discord bot token (required)
 *   guildId         — Discord server/guild ID (required)
 *   channels        — map of channel name → Discord channel ID (required)
 *   gatewayUrl      — OpenClaw gateway URL (default: http://127.0.0.1:18789)
 *   gatewayToken    — OpenClaw gateway auth token (default: dev-token)
 *   agentId         — OpenClaw agent ID (default: main)
 *   postOnlyChannels — channels the bot posts to but doesn't process input from
 *   dmPolicy        — "allowlist" (default) or "open"
 *   allowFrom       — list of permitted Discord user IDs
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { setDiscordRuntime } from "./src/runtime.js";
import { startDiscordBot, stopDiscordBot } from "./src/channel.js";
import type { DiscordChannelConfig } from "./src/channel.js";

const plugin = {
  id: "discord",
  name: "Discord",
  description: "Discord bot channel with per-channel workflow context routing",
  configSchema: emptyPluginConfigSchema(),

  register(api: OpenClawPluginApi) {
    setDiscordRuntime(api.runtime);

    const cfg = api.runtime.config.get<{ discord?: DiscordChannelConfig }>("channels");
    const discordCfg = cfg?.discord;

    if (!discordCfg?.enabled) {
      console.log("[discord] Plugin registered but not enabled — set channels.discord.enabled: true");
      return;
    }

    if (!discordCfg.botToken) {
      console.error("[discord] Missing channels.discord.botToken — bot will not start");
      return;
    }

    if (!discordCfg.guildId) {
      console.error("[discord] Missing channels.discord.guildId — bot will not start");
      return;
    }

    if (!discordCfg.channels || Object.keys(discordCfg.channels).length === 0) {
      console.error("[discord] No channels configured — set channels.discord.channels");
      return;
    }

    startDiscordBot(discordCfg).catch((err: unknown) => {
      console.error("[discord] Failed to start bot:", err);
    });

    // Register a graceful shutdown hook
    api.runtime.onShutdown?.(() => stopDiscordBot());
  },
};

export default plugin;
