# Jarvis v1 — Slack App Integration (Socket Mode)

The Slack Gateway integration (`gateway/src/integrations/slack_client.ts`) allows Meridian employees to interact with Jarvis directly within their Slack workspaces without exposing inbound public webhooks or firewall ports.

---

## 1. Socket Mode Architecture
- **Library:** `@slack/bolt` (v3.21.4).
- **Transport:** Outbound persistent WebSocket connection to Slack using an App-level token (`xapp-1-...`).
- **Firewall Friendly:** Requires zero inbound open ports or reverse proxies (e.g. ngrok is not needed).

---

## 2. Strict Employee Identity Verification
To prevent identity spoofing:
1. Slack provides the `user_id` of the message author (e.g. `U01234567`).
2. The Gateway immediately queries the Slack Web API: `client.users.info({ user: slackUserId })`.
3. Extracts the verified corporate email: `userInfo.user.profile.email`.
4. The Gateway queries `jarvis_system.api_tokens` to resolve the employee's `UserContext` and active role.
5. **Security Rule:** Any user without an active, verified corporate email in `jarvis_system` is rejected with an access-denied message.

---

## 3. Supported Interaction Patterns
- **Channel Mentions:** `@Jarvis What are our receiving numbers for today?` $\to$ Responds in thread.
- **Direct Messages:** Private one-on-one consultation with Jarvis $\to$ Direct reply.
- **Action Proposals:** Proposing a credit hold returns the proposal details and directs the user to the Action Center for confirmation. Ordinary conversation never triggers database writes.
