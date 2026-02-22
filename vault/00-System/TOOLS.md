---
type: system
tags: [system, tools]
updated: {{date}}
---

# TOOLS

Available tools and usage notes for OpenClaw agents.

## Built-in Tools

### Web Search
- **Status**: enabled
- **Usage**: use for current events, pricing, research, and anything beyond
  training knowledge. Prefer specific queries over broad ones.

### Web Fetch
- **Status**: disabled (enable per-session if needed)

### Agent-to-Agent
- **Status**: enabled
- **Usage**: spawn subagents for parallel work; max 8 concurrent subagents.

## Skills

### LinkedIn Post (`/linkedin`)
Post text, URL/article, or image content to LinkedIn.
- Configured in: `extensions/linkedin/`
- Auth: OAuth (manual code paste flow)

### Prompt Translator (`/prompt-translator`)
Optimises prompts for specific model families before submission.
- Configured in: `extensions/prompt-translator/`
- Supports: Claude (Opus/Sonnet), GLM-5, GLM-4.7

## Discord Channels as Workflow Tools

| Channel | Tool behaviour |
|---|---|
| `#general` | General assistant — any task |
| `#summaries` | Drop a URL → summarise and save to `vault/20-Summaries/` |
| `#moltbook` | Receives Moltbook Ghost Hunter cron output |
| `#biz_ideas` | Research + plan generation → save to `vault/30-Biz-Ideas/` |
| `#monitoring` | Receives cron job reports and server alerts |
| `#briefing` | Receives daily morning briefing (08:00 JST) |

## Notes

<!-- Add tool-specific notes or usage tips below -->
