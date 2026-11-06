import bolt from '@slack/bolt';
import { config } from '../config/environment.js';
import { IdentityResolver } from '../auth/identity_resolver.js';
import { IntentRouter } from '../orchestrator/intent_router.js';

const { App } = bolt;

export class SlackService {
  private static app: any = null;
  private static isConnected = false;

  public static async initialize(): Promise<void> {
    if (!config.slackAppToken || !config.slackBotToken) {
      console.log('[SLACK_GATEWAY] Slack tokens not configured. Slack Socket Mode standing by in readiness mode.');
      return;
    }

    try {
      this.app = new App({
        token: config.slackBotToken,
        appToken: config.slackAppToken,
        socketMode: true,
      });

      // 1. Handle Mentions & Direct Messages
      this.app.event('app_mention', async ({ event, client, say }: any) => {
        await this.handleMessage({ event, client, say });
      });

      this.app.message(async ({ event, client, say }: any) => {
        // Direct messages (channel_type === 'im')
        if (event.channel_type === 'im') {
          await this.handleMessage({ event, client, say });
        }
      });

      await this.app.start();
      this.isConnected = true;
      console.log('⚡️ [SLACK_GATEWAY] Jarvis Slack Bolt Socket Mode client connected successfully.');
    } catch (err: any) {
      console.error('[SLACK_INIT_ERROR]', err.message);
    }
  }

  private static async handleMessage({ event, client, say }: any) {
    try {
      const slackUserId = event.user;
      const text = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();

      if (!text) {
        await say({
          text: 'Hello! I am Jarvis, your Meridian Supply Chain intelligence assistant. How can I help you today?',
          thread_ts: event.ts,
        });
        return;
      }

      // Resolve user's verified email from Slack API
      let corporateEmail = '';
      try {
        const userInfo = await client.users.info({ user: slackUserId });
        corporateEmail = userInfo.user?.profile?.email || '';
      } catch (e: any) {
        console.error('[SLACK_USER_INFO_ERROR]', e.message);
      }

      if (!corporateEmail) {
        await say({
          text: '⚠️ Identity Verification Failed: Could not resolve a verified corporate email from your Slack account.',
          thread_ts: event.ts,
        });
        return;
      }

      // Resolve employee UserContext
      const userContext = await IdentityResolver.resolveFromSlackUserId(slackUserId, corporateEmail);
      if (!userContext) {
        await say({
          text: `⚠️ Access Denied: No active Jarvis account found for '${corporateEmail}'. Please request an MCP bearer token from your administrator.`,
          thread_ts: event.ts,
        });
        return;
      }

      // Execute through IntentRouter
      const routeResult = await IntentRouter.routeAndExecute(text, userContext);

      await say({
        text: routeResult.response,
        thread_ts: event.ts,
      });
    } catch (err: any) {
      console.error('[SLACK_MESSAGE_HANDLER_ERROR]', err);
      await say({
        text: `⚠️ An error occurred while processing your request: ${err.message}`,
        thread_ts: event.ts,
      });
    }
  }

  public static getStatus() {
    return {
      connected: this.isConnected,
      socketMode: true,
      configured: Boolean(config.slackAppToken && config.slackBotToken),
    };
  }

  public static async shutdown() {
    if (this.app) {
      try {
        await this.app.stop();
        this.isConnected = false;
      } catch {}
    }
  }
}
