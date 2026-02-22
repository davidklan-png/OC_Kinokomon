---
type: system
tags: [system, agents, config]
updated: {{date}}
---

# AGENTS

This file defines the agents available in OpenClaw and their configuration.

## Main Agent

- **ID**: `main`
- **Model (primary)**: `zai/glm-4.7`
- **Model aliases**: GLM-5, GLM (4.7), Opus, Sonnet
- **Max concurrent**: 4 agents / 8 subagents

## Agent Roles

<!-- Define agent roles, specialisations, and when to use each model below -->

### GLM-4.7 (default)
Use for: daily tasks, summaries, Moltbook, monitoring, briefings.

### GLM-5 (reasoning)
Use for: complex analysis, business research, multi-step planning.

### Claude Opus 4.6
Use for: high-stakes writing, nuanced judgement, strategic decisions.

### Claude Sonnet 4.6
Use for: code generation, structured output, faster iteration.

## Notes

<!-- Add any agent-specific instructions or constraints here -->
