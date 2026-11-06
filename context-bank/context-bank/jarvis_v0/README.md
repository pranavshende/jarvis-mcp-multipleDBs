# Jarvis v0

_Owner: Arjun Mehta · launched 2026-05-14 · status: pilot_

Jarvis is our company-brain experiment: one assistant that knows MSC, answers questions from live data and
remembers what the team learns.

## What it does today
- **Slack bot** (`@jarvis` in any channel or DM) and an **MCP connector** for Claude desktop / Claude Code.
- On every question it builds a prompt with:
  1. the system prompt (`prompts/system.md`)
  2. **MSC Now** in full (Sam wanted Jarvis to always know current priorities)
  3. the **whole memory file** (`memory.jsonl`)
  4. the top 5 notes by keyword match
- Tools: `sql(db, query)` against the three databases as `jarvis_svc`, `seller_api(method, path, body)` with the
  integration key, `search_notes(q)`.
- **Memory:** anything said with "remember:" is appended to memory. A nightly job reads the session-log export,
  asks the model to extract "durable facts about MSC" from each session and appends them. No review step — Sam
  wanted it to learn automatically.

## Setup for users
- Slack: just mention @jarvis.
- Claude desktop: add the MCP server URL from 1Password ("jarvis-mcp") in Settings → Connectors. (Instructions in
  #jarvis pinned message.)

## Known issues
- Slow (20–45s per answer).
- Costs more per question than expected.
- Sometimes answers with numbers from memory instead of querying.
- Doesn't know which "yesterday" people mean.

## Files in this export
- `config.yaml` — runtime config
- `prompts/system.md` — system prompt
- `memory_dump.jsonl` — memory file as of the snapshot
- `usage_events.jsonl` — question/answer/ingest events for the last 90 days
- `injection_log.jsonl` — output of the prompt-injection filter
- `cost_stats.csv` — daily tokens and cost
- `feedback.md` — export of the #jarvis Slack channel
