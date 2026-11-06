# Session logs

Nightly export from team AI workspaces (Claude Team, ChatGPT Team, Gemini, Cursor, Codex) for the 8 people who opted in to the Jarvis pilot export. One file per person per day, one JSON event per line.

Fields: `ts` (UTC), `session_id`, `user`, `tool`, `model`, `event` (user_prompt, assistant, tool_call, tool_result, session_end), `content`, token counts. `session_end` carries totals and an estimated cost.

Assistant messages are stored as the workspace export provides them; some are truncated. Attachments are shown as `(attached: …)` placeholders.
