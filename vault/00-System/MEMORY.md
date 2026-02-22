---
type: system
tags: [system, memory, context]
updated: {{date}}
---

# MEMORY

This file defines how OpenClaw manages memory and context across sessions.

## Memory Architecture

OpenClaw uses three layers of memory:

1. **Session memory** — in-context tokens for the current conversation
   - Stored in `agents/main/sessions/` as compressed JSONL
   - Compaction mode: `safeguard` (preserves critical context)

2. **SQLite memory** — persistent key/value store
   - Located at `memory/main.sqlite`
   - Used for long-term facts, user preferences, and entity data

3. **Vault memory** — structured Obsidian notes
   - Located in `vault/` subdirectories
   - Human-readable, version-controlled, Dataview-queryable

## Per-Channel Context Strategy

Each Discord channel maintains its own session context:

| Channel | Session key | Context scope |
|---|---|---|
| `#general` | `agent:main:discord:general` | Rolling window, general |
| `#summaries` | `agent:main:discord:summaries` | URL context only, save to vault |
| `#moltbook` | `agent:main:discord:moltbook` | Moltbook run history |
| `#biz_ideas` | `agent:main:discord:biz_ideas` | Full research context |
| `#monitoring` | `agent:main:discord:monitoring` | Alert history |
| `#briefing` | `agent:main:discord:briefing` | Briefing history |

## Memory Rules

1. Long-form output (summaries, research, plans) is **always saved to vault**,
   not kept only in chat history
2. Session context is **not** shared across channels — each channel is an
   isolated memory context
3. The `#biz_ideas` channel context is preserved longest (most valuable)
4. `#monitoring` and `#briefing` sessions are cleared after 7 days

## Saving to Vault

When saving notes from Discord:
- `#summaries` → `vault/20-Summaries/web/` or `vault/20-Summaries/video/`
- `#biz_ideas` → `vault/30-Biz-Ideas/discovery/` then `vault/30-Biz-Ideas/plans/`
- `#moltbook` → `vault/40-Moltbook/`
- `#monitoring` → `vault/50-Monitoring/`
- `#briefing` → `vault/10-Daily/`

All vault notes use YAML frontmatter with `date`, `tags`, and `source` fields.

## Notes

<!-- Memory management rules and exceptions go here -->
