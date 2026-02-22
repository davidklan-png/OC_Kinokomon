# Prompt Translator

Translate human prompts into model-specific instructions optimized for the target model's strengths, API conventions, and prompting best practices.

## When to Use

This skill is invoked automatically whenever OpenClaw routes a prompt to a model. Apply the relevant model-specific guide below to adapt the prompt before submission. If the user explicitly invokes `/prompt-translate`, show the translated prompt for review instead of sending it directly.

## Commands

### `/prompt-translate <text>`
Display the model-optimized version of `<text>` for the current active model without sending it.

### `/prompt-translate model:<model> <text>`
Display the optimized version targeting a specific model (e.g., `model:glm-5`, `model:opus`).

---

## General Translation Principles

Before applying model-specific rules, follow these universal principles:

1. **Preserve intent** — never add, remove, or change the user's goal.
2. **Be explicit** — convert vague requests into specific, actionable instructions.
3. **Add structure** — use headings, numbered steps, or XML tags where the target model benefits from them.
4. **Match the model's format strengths** — use XML tags for Claude, structured markdown for GLM.
5. **Set context** — add role or motivation framing when the original prompt lacks it.
6. **Specify output format** — if the user implies a format (JSON, code, prose), make it explicit.
7. **Right-size the prompt** — avoid anti-laziness or over-thoroughness language unless the task genuinely requires extended effort.

---

## Model-Specific Guides

---

### Claude (Anthropic)

**Applies to:** `claude-opus-4-20250514` (Opus), `claude-sonnet-4-20250514` (Sonnet)

#### Core Principles

- **Be explicit with instructions.** Claude responds well to clear, specific instructions. If you want extensive output, say so directly: *"Include as many relevant features as possible. Go beyond the basics."*
- **Add context / motivation.** Explain *why* a behavior matters. Instead of *"NEVER use ellipses"*, say *"Your response will be read aloud by a text-to-speech engine, so never use ellipses since the engine cannot pronounce them."* Claude generalizes from the explanation.
- **Be vigilant with examples.** Claude pays close attention to examples. Ensure examples align with desired behaviors and minimize undesired patterns.

#### Formatting

- Tell Claude what to do, not what *not* to do. Instead of *"Do not use markdown"*, say *"Write in smoothly flowing prose paragraphs."*
- Use **XML tags** to delineate sections, instructions, and output containers:
  ```xml
  <instructions>
  Analyze the following document and extract key themes.
  </instructions>
  <document>
  ...
  </document>
  ```
- Match prompt style to desired output style — markdown in the prompt tends to produce markdown output.
- For minimal markdown:
  ```
  Write in clear flowing prose using complete paragraphs. Reserve markdown for
  inline code and code blocks only. Avoid bold, italics, bullet lists, and
  numbered lists unless truly discrete items.
  ```

#### Tool & Action Bias

- Claude 4.6 models follow instructions precisely. If you say *"suggest changes"*, Claude will *only suggest* and not act.
- To make Claude act: use imperative verbs — *"Change this function"*, *"Make these edits"*, *"Implement the feature"*.
- For proactive action by default:
  ```xml
  <default_to_action>
  Implement changes rather than only suggesting them. If intent is unclear,
  infer the most useful action and proceed.
  </default_to_action>
  ```

#### Thinking & Reasoning

- Claude Opus 4.6 uses **adaptive thinking** — it decides when and how much to reason. Do NOT add explicit "think step by step" or "use the think tool" instructions; these cause over-planning.
- Use the `effort` parameter as the primary control lever (low / medium / high / max).
- To reduce overthinking:
  ```
  Prioritize execution over deliberation. Choose one approach and start
  producing output immediately. Write each piece once; do not revise.
  ```
- **Remove anti-laziness prompts.** Instructions like "be thorough" or "do not be lazy" amplify already-proactive behavior in Claude 4.6 and can cause runaway thinking loops.

#### Long-Horizon & Multi-Window Tasks

- Claude 4.6 excels at state tracking across extended sessions. Use structured formats (JSON) for state data and freeform text for progress notes.
- Use git for checkpointing. Claude's latest models are effective at discovering state from the filesystem.
- Encourage incremental progress: *"Plan your work clearly. Spend your entire output context working on the task. Continue systematically until complete."*
- For context-compacted environments, tell Claude: *"Your context will be automatically compacted. Do not stop tasks early due to budget concerns. Save progress before the window refreshes."*

#### Parallel Tool Calling

- Claude 4.6 excels at parallel execution. Boost to near-100% with:
  ```xml
  <use_parallel_tool_calls>
  Make all independent tool calls in parallel. Only call sequentially when
  outputs of one call inform parameters of another.
  </use_parallel_tool_calls>
  ```

#### Subagent Orchestration

- Claude Opus 4.6 proactively delegates to subagents. To prevent overuse:
  ```
  Use subagents for parallel tasks, isolated context, or independent workstreams.
  For simple tasks, sequential operations, or single-file edits, work directly.
  ```

#### Avoiding Overengineering

- Claude 4.6 may create extra files, unnecessary abstractions, or anticipatory flexibility. Constrain with:
  ```
  Only make changes that are directly requested or clearly necessary. Don't add
  features, refactor code, or make improvements beyond what was asked. Don't
  create helpers or abstractions for one-time operations.
  ```

#### Safety & Reversibility

- Claude Opus 4.6 may take hard-to-reverse actions without asking. Add:
  ```
  For destructive or externally-visible actions (deleting files, force-pushing,
  posting to services), ask before proceeding. Take local, reversible actions freely.
  ```

#### Hallucination Reduction

- Add when factual accuracy is critical:
  ```xml
  <investigate_before_answering>
  Never speculate about code you have not opened. Read relevant files BEFORE
  answering questions. Give grounded, hallucination-free answers.
  </investigate_before_answering>
  ```

#### Claude Sonnet 4.6 Specific

- Defaults to `effort: high`. For latency-sensitive workloads, explicitly set to `medium` or `low`.
- For coding use cases: start with `medium` effort, 16k thinking budget.
- For chat / non-coding: start with `low` effort.
- Set `max_tokens` to at least 16384 to give room for thinking.

#### Claude Opus 4.6 Specific

- Best for hardest, longest-horizon problems: large-scale code migrations, deep research, extended autonomous work.
- Uses adaptive thinking by default — no budget_tokens needed.
- Sensitive to aggressive tool-triggering language. Replace *"You MUST use this tool"* with *"Use this tool when it would enhance your understanding."*

---

### GLM-5 (ZAI / Zhipu)

**Applies to:** `glm-5`

#### Core Principles

- **Design system prompts with clear role definitions.** Define the AI's role explicitly, specify output format, request concrete solutions, include runnable code examples, and highlight potential risks.
- **Leverage agentic strengths.** GLM-5 is specifically designed for long-cycle agent tasks with autonomous planning and tool calling. Frame prompts as objectives with tool access rather than step-by-step instructions.
- **Prefer Chinese for nuanced tasks** when the user's content is Chinese. GLM-5 has native bilingual strength (Chinese/English) and may produce higher-quality reasoning in Chinese for ambiguous or culturally-specific content.

#### Temperature Settings

| Task Type | Temperature | Use Case |
|-----------|------------|----------|
| 0.1 – 0.3 | Low | Code generation, data extraction, format conversion |
| 0.5 – 0.7 | Medium | Technical docs, Q&A, summaries |
| 0.8 – 1.0 | High | Creative writing, brainstorming |
| 1.0 | Thinking | Deep reasoning, mathematical proofs, complex programming |

#### Thinking Mode

- Enable for complex reasoning:
  ```python
  extra_body={"thinking": {"type": "enabled"}}
  ```
- Use `temperature: 1.0` when thinking is enabled.
- Disable for simple tasks to reduce latency.
- GLM-5's thinking mode performs internal chain-of-thought reasoning before answering, significantly boosting performance on math, logic, and programming problems.

#### Long Context Handling (200K window)

- **Place critical information first** — GLM models attend more reliably to content at the beginning of the context.
- Segment documents exceeding 100K tokens.
- Leverage automatic context caching for repeated prefixes (cached input is 1/5 the price).
- Set `max_tokens` appropriately to avoid unnecessary generation length.

#### Tool Calling & Agentic Use

- GLM-5 leans on bash/exec tools more heavily than search tools (contrast with Claude which prefers search). Structure tool descriptions to match this bias.
- Use OpenAI-style function calling format — GLM-5's API is OpenAI-compatible.
- GLM-5 achieves SOTA on agent benchmarks (HLE w/ Tools: 50.4%). Trust its planning ability for multi-step agent workflows.

#### Output Format

- Use structured markdown rather than XML tags (unlike Claude).
- For structured output, specify JSON schemas directly in the prompt.
- GLM-5 handles long-form generation well (up to 128K output tokens). Explicitly state desired length when you need extended output.

#### Formatting Prompts for GLM-5

```
You are a [role]. Your task is to [objective].

## Requirements
- [specific requirement 1]
- [specific requirement 2]

## Output Format
Return your response as [format description].

## Important Notes
- [constraint or risk to highlight]
```

#### Hallucination Awareness

- GLM-5 has a record-low hallucination rate among open-source models. For factual tasks, it's reliable without extra grounding prompts.
- Still add source verification prompts for research tasks across multiple documents.

---

### GLM-4.7 (ZAI / Zhipu)

**Applies to:** `glm-4.7`, `glm-4.7-flash`, `glm-4.7-flashx`

#### Core Principles

- **Native Chain-of-Thought (CoT).** GLM-4.7 has a built-in "Thinking Process" — when presented with difficult prompts, it generates an internal monologue breaking the problem into sub-tasks. You can encourage this with prompts that ask the model to "reason through" rather than answer immediately.
- **Reasoning density over parameter count.** GLM-4.7 is optimized to use its parameters more effectively during inference. Every token contributes to coherent, logically sound conclusions.
- **OpenAI-compatible API.** Standard prompt engineering patterns (system/user/assistant roles, function calling) apply directly with no adaptation needed.

#### Thinking Mode Configuration

- Thinking mode is **enabled by default**. To disable:
  ```python
  extra_body={"chat_template_kwargs": {"enable_thinking": False}}
  ```
- Three thinking modes available:
  - **Interleaved** — reasons before each response and tool invocation
  - **Retention-based** — preserves reasoning blocks across multi-turn dialogues
  - **Round-level** — per-session control over reasoning

#### Temperature Defaults

- Default temperature: **1.0** (same as GLM-5 and GLM-4.6 series).
- Lower (~0.2) for factual Q&A and code generation.
- Higher (~0.8) for creative tasks.

#### Coding Strength

- GLM-4.7 writes clean, idiomatic code in Python, JavaScript, C++, and handles edge cases gracefully.
- Focuses on **task completion** — delivers structurally complete, executable code frameworks rather than fragments.
- For coding prompts, frame as complete objectives: *"Write a complete [component] that [does X]. Include error handling and tests."*

#### Frontend Development

- GLM-4.7 has enhanced visual comprehension — improved layout structures, color harmony, and component styling.
- For UI prompts, include design specifications: colors, spacing, typography, responsive breakpoints.

#### Tool Calling

- GLM-4.7 scores 84.7 on the interactive tool benchmark (outperforming Claude Sonnet 4.5).
- Use OpenAI-style tool/function definitions directly.
- The model handles multi-step tool chains well — describe the available tools and let it orchestrate.

#### Multi-Turn Conversations

- GLM-4.7 maintains context reliably during multi-turn conversations.
- Use iterative feedback to refine outputs — the model learns from corrections within the conversation.

#### Formatting Prompts for GLM-4.7

```
## Task
[Clear description of what to accomplish]

## Context
[Relevant background information]

## Constraints
- [Constraint 1]
- [Constraint 2]

## Expected Output
[Description of desired output format and content]
```

#### Flash & FlashX Variants

- **GLM-4.7-Flash**: Free, lightweight model. Best for high-volume, latency-sensitive tasks. Same prompting patterns apply, but keep prompts concise to maximize throughput.
- **GLM-4.7-FlashX**: Balanced speed/quality. Good for real-time interactive applications. Prompting patterns are identical to the full GLM-4.7.

---

## Translation Quick Reference

| Dimension | Claude (Opus/Sonnet) | GLM-5 | GLM-4.7 |
|-----------|---------------------|-------|---------|
| **Structure tags** | XML tags (`<instructions>`, `<document>`) | Markdown headings and lists | Markdown headings and lists |
| **Thinking control** | Adaptive (automatic); steer via `effort` param | Enable/disable via `thinking` param; temp=1.0 when on | On by default; three modes (interleaved/retention/round) |
| **Anti-laziness prompts** | Remove — causes overthinking | Not needed — strong agent autonomy | Not needed — native CoT handles complexity |
| **Tool triggering** | Soften language (*"use when helpful"*) | Standard OpenAI function format | Standard OpenAI function format |
| **Action bias** | Use imperative verbs; add `<default_to_action>` block | Frame as objectives with tool access | Frame as complete tasks |
| **Temperature** | API default; tune via effort | 0.1–1.0 by task type; 1.0 for thinking | Default 1.0; lower for code/facts |
| **Context priority** | Even attention across context | Front-load critical information | Even attention; reliable multi-turn |
| **Output length** | Set max_tokens generously (16k+ for thinking) | Up to 128K; specify desired length | Up to 128K; specify desired length |
| **Code prompts** | Imperative: *"Implement X"* | Objective: *"Build a complete X that does Y"* | Task-complete: *"Write complete X with tests"* |
| **Safety guardrails** | Add reversibility checks for destructive actions | Standard — less prone to unsolicited destructive actions | Standard — less prone to unsolicited destructive actions |
| **Parallel execution** | Explicit `<use_parallel_tool_calls>` block | Native via OpenAI tool_choice | Native via OpenAI tool_choice |
| **Hallucination** | Add `<investigate_before_answering>` for code tasks | Low rate natively; add verification for research | Reliable; add verification for research |
| **Bilingual** | English-primary | Strong Chinese/English bilingual | Strong Chinese/English bilingual |

---

## Example Translations

### User prompt:
> "Make a REST API for managing tasks"

### Translated for Claude Opus 4.6:
```xml
<instructions>
Implement a complete REST API for managing tasks. Use Express.js with TypeScript.

Include these endpoints:
- POST /tasks — create a task
- GET /tasks — list all tasks with optional status filter
- GET /tasks/:id — get a single task
- PUT /tasks/:id — update a task
- DELETE /tasks/:id — delete a task

Each task has: id, title, description, status (pending/in_progress/completed), createdAt, updatedAt.

Use in-memory storage. Include input validation and proper HTTP status codes.
Write the implementation directly — do not just suggest changes.
</instructions>
```

### Translated for GLM-5:
```
You are a backend engineer. Your task is to build a complete REST API for managing tasks.

## Requirements
- Framework: Express.js with TypeScript
- Endpoints: CRUD operations (POST, GET, GET/:id, PUT/:id, DELETE/:id)
- Task schema: id, title, description, status (pending/in_progress/completed), createdAt, updatedAt
- In-memory storage
- Input validation and proper HTTP status codes

## Output Format
Return the complete, runnable code as a single TypeScript file with all imports and type definitions.

## Important Notes
- Include error handling for invalid IDs and missing required fields
- Use proper REST conventions for status codes (201 for creation, 404 for not found, etc.)
```

### Translated for GLM-4.7:
```
## Task
Build a complete REST API for managing tasks using Express.js with TypeScript.

## Context
This is a standalone task management API with in-memory storage. It should be production-quality code structure even though storage is in-memory.

## Constraints
- Endpoints: POST /tasks, GET /tasks (with status filter), GET /tasks/:id, PUT /tasks/:id, DELETE /tasks/:id
- Task fields: id, title, description, status (pending/in_progress/completed), createdAt, updatedAt
- Include input validation and proper HTTP status codes
- Single runnable TypeScript file

## Expected Output
Complete, executable TypeScript code with all type definitions, route handlers, validation, and error handling included.
```
