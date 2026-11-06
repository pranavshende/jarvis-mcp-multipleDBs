import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const connection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const operationalQueue = new Queue('jarvis-operational-queue', { connection });

async function setupRepeatableSchedules() {
  console.log(`[Scheduler] Initializing BullMQ Repeatable Schedules on Redis ${REDIS_HOST}:${REDIS_PORT}...`);

  // 1. ACH Payout Monitor — every 15 minutes
  await operationalQueue.add(
    'ach_payout_monitor',
    { rule: 'ACH_PAYOUT_FAILURE', priority: 'HIGH' },
    {
      repeat: { pattern: '*/15 * * * *' },
      jobId: 'repeat-ach-payout-monitor',
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );
  console.log('[Scheduler] Registered: ach_payout_monitor (*/15 * * * *)');

  // 2. Partner Credit Breach Monitor — every hour
  await operationalQueue.add(
    'partner_credit_monitor',
    { rule: 'PARTNER_CREDIT_BREACH', priority: 'CRITICAL' },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'repeat-partner-credit-monitor',
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );
  console.log('[Scheduler] Registered: partner_credit_monitor (0 * * * *)');

  // 3. Inventory Price Inversion Monitor — daily at midnight
  await operationalQueue.add(
    'inventory_inversion_monitor',
    { rule: 'INVENTORY_PRICE_INVERSION', priority: 'MEDIUM' },
    {
      repeat: { pattern: '0 0 * * *' },
      jobId: 'repeat-inventory-inversion-monitor',
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );
  console.log('[Scheduler] Registered: inventory_inversion_monitor (0 0 * * *)');

  // 4. Statistical Anomaly Detector — daily at 01:00 UTC
  await operationalQueue.add(
    'anomaly_detector',
    { rule: 'STATISTICAL_ANOMALY', priority: 'HIGH' },
    {
      repeat: { pattern: '0 1 * * *' },
      jobId: 'repeat-anomaly-detector',
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  );
  console.log('[Scheduler] Registered: anomaly_detector (0 1 * * *)');

  console.log('[Scheduler] All BullMQ repeatable jobs configured successfully.');
}

if (require.main === module) {
  setupRepeatableSchedules()
    .then(() => {
      console.log('[Scheduler] Running. Press Ctrl+C to stop.');
    })
    .catch((err) => {
      console.error('[Scheduler] Initialization failed:', err);
      process.exit(1);
    });
}
