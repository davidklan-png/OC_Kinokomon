---
type: meta
tags: [meta, vault, index]
---

# OC Kinokomon — Obsidian Vault

This vault is the persistent knowledge base for the OpenClaw Kinokomon agent.
It is version-controlled inside the `OC_Kinokomon` git repository.

## Folder Structure

| Folder | Purpose | Discord channel |
|---|---|---|
| `00-System/` | OpenClaw workspace files (injected into every session) | — |
| `10-Daily/` | Morning briefings and daily summaries | `#briefing` |
| `20-Summaries/` | Web page and YouTube video summaries | `#summaries` |
| `30-Biz-Ideas/` | Business idea discovery and execution plans | `#biz_ideas` |
| `40-Moltbook/` | Moltbook activity logs from cron runs | `#moltbook` |
| `50-Monitoring/` | Server health reports and cron alerts | `#monitoring` |
| `60-Skills/` | OpenClaw skill documentation | — |

## Recommended Obsidian Plugins

| Plugin | Purpose |
|---|---|
| **Dataview** | Query notes by tag, date, or field across folders |
| **Calendar** | Navigate `10-Daily/` notes by date |
| **Templater** | Auto-fill frontmatter and date fields |
| **Tag Wrangler** | Manage and rename tags across vault |

## Note Format

All notes use YAML frontmatter:

```yaml
---
date: YYYY-MM-DD
type: summary | biz-idea | report | briefing | heartbeat
tags: [tag1, tag2]
source: https://...    # for summaries
channel: discord-channel-name
---
```

## Maintenance

- `00-System/` files are the source of truth for OpenClaw's configuration
  and behaviour — edit them in Obsidian to change how the agent behaves
- `vault/.obsidian/` is git-ignored (local Obsidian config only)
- Commit vault changes with descriptive messages: `vault: add biz idea — <name>`
