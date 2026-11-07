# How we use AI at MSC

_Owner: Sam · v3 · 2026-08-11_

Short version: use it for everything, check what matters, don't paste secrets.

## Seats
- Claude Team: Sam, Priya, Kenji, Arjun, Leo, Hannah, Zoe, Mei
- ChatGPT Team: Marcus, Sofia, Chloe, Owen, Maya, Ethan, Lucia, Isaac
- Cursor: Arjun, Leo, Felix
- Gemini: Dana (uses the CLI on the West office laptop), Nora
- Codex: Leo, Felix

## Rules
1. Don't paste member bank details, partner payment info, or payroll into any AI chat.
2. Customer-facing messages written with AI must be read by a human before sending.
3. If an AI gives you a number, say where the number came from when you share it.
4. Session logs from Claude/ChatGPT team workspaces are exported nightly to the shared drive so Jarvis can learn
   from them. You don't need to do anything.

## Jarvis
Jarvis is our in-house "company brain". Ask it in Slack (`@jarvis`) or from Claude via the MCP connector. It reads
the notes folder, the daily session exports, and has read access to the databases. Anything you tell it with
"remember:" gets added to its memory for everyone. See `jarvis_v0/README.md`.

## Budget
AI tools were ~$4.4k in July and are climbing ~8%/month. Sam wants that number going **down** in Q4 while usage goes
**up**. Ideas welcome in #jarvis.
