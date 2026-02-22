/**
 * post.ts — Proactive posting helper for cron jobs and alerts.
 *
 * Usage (from a cron script or agent tool):
 *   POST http://localhost:18789/discord/post
 *   Authorization: Bearer <gateway-token>
 *   { "channel": "monitoring", "message": "..." }
 */

import type { Client, TextChannel } from "discord.js";

let discordClient: Client | null = null;
let channelMap: Record<string, string> = {};

export function setPostClient(client: Client, channels: Record<string, string>): void {
  discordClient = client;
  channelMap = channels;
}

/**
 * Post a message to a named Discord channel (e.g. "monitoring", "briefing").
 * Splits messages longer than 2000 characters into chunks.
 */
export async function postToChannel(channelName: string, message: string): Promise<void> {
  if (!discordClient) {
    throw new Error("Discord client not initialised");
  }

  const channelId = channelMap[channelName];
  if (!channelId) {
    throw new Error(`No channel ID configured for channel name: ${channelName}`);
  }

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Channel ${channelId} is not a text channel`);
  }

  const textChannel = channel as TextChannel;
  const CHUNK = 1990;

  if (message.length <= CHUNK) {
    await textChannel.send(message);
    return;
  }

  // Split on newlines where possible to avoid breaking markdown
  const chunks: string[] = [];
  let remaining = message;
  while (remaining.length > 0) {
    if (remaining.length <= CHUNK) {
      chunks.push(remaining);
      break;
    }
    let cutAt = remaining.lastIndexOf("\n", CHUNK);
    if (cutAt < CHUNK / 2) cutAt = CHUNK;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }

  for (const chunk of chunks) {
    await textChannel.send(chunk);
  }
}
