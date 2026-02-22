---
type: system
tags: [system, heartbeat, cron]
updated: {{date}}
---

# HEARTBEAT

Heartbeat defines the scheduled autonomous tasks that run without user input.

## Scheduled Jobs

### Moltbook Ghost Hunter
- **Schedule**: every 4 hours (anchored to Unix epoch)
- **Channel**: posts output to Discord `#moltbook`
- **Script**: `moltbook-ghost-hunter.js`
- **Model**: `zai/glm-4.7`
- **Timeout**: 180 seconds
- **Session**: isolated per run

**Purpose**: [describe what Moltbook Ghost Hunter does]

### Morning Briefing
- **Schedule**: daily at 08:00 JST (cron: `0 8 * * *`)
- **Channel**: posts to Discord `#briefing`
- **Model**: `zai/glm-4.7`

**Purpose**: Generate a structured daily briefing covering:
1. Summary of yesterday's Discord activity (key threads, decisions)
2. Scheduled events or reminders
3. Any pending items from `#biz_ideas` or `#moltbook`
4. Server health snapshot from `#monitoring`

## Heartbeat Behaviour

- Each scheduled job runs in an **isolated session** (no shared context)
- Job results are posted to the designated Discord channel
- Failed jobs report to `#monitoring` with error details
- Consecutive errors trigger a warning post in `#monitoring`

## Notes

<!-- Add notes about heartbeat schedule changes or job modifications here -->
