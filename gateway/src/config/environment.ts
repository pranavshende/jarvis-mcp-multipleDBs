import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from gateway dir, server dir, root dir, or local dir
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || '4000', 10),
  host: process.env.GATEWAY_HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Downstream Flask Backend (Phases 1-3)
  flaskBackendUrl: process.env.FLASK_BACKEND_URL || 'http://127.0.0.1:5000',
  
  // Database Direct and Pooler Connection
  databaseUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || '',

  // AI Model Provider Configuration
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  
  // Slack Socket Mode Configuration
  slackAppToken: process.env.SLACK_APP_TOKEN || '',
  slackBotToken: process.env.SLACK_BOT_TOKEN || '',
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',

  // Gateway Security & Tokens
  tokenPrefix: 'msc_mcp_',
  defaultTokenExpiryDays: 90,
  
  // Timeouts (ms)
  downstreamTimeoutMs: 15000,
  mcpKeepaliveIntervalMs: 15000,
};
