import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const FLASK_API_URL = process.env.FLASK_API_URL || 'http://127.0.0.1:5000';

const connection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const operationalWorker = new Worker(
  'jarvis-operational-queue',
  async (job: Job) => {
    const startTime = Date.now();
    console.log(`[Worker] Received job ${job.id} of type: ${job.name}`);

    // Trigger rule execution via Flask API
    const response = await fetch(`${FLASK_API_URL}/api/monitoring/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ job: job.name }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Execution failed with status ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;
    console.log(`[Worker] Job ${job.id} (${job.name}) completed successfully in ${durationMs}ms`);
    return { ...result, durationMs };
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

operationalWorker.on('completed', (job: Job, returnvalue: any) => {
  console.log(`[Worker] Job ${job.id} completed. Result:`, returnvalue.status || 'OK');
});

operationalWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
});

console.log(`[Worker] BullMQ worker listening on 'jarvis-operational-queue' (Redis ${REDIS_HOST}:${REDIS_PORT})...`);
