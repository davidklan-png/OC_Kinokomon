import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setDiscordRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getDiscordRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Discord runtime not initialized — plugin not registered");
  }
  return runtime;
}
