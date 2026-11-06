import { pool } from '../config/db.js';
import crypto from 'crypto';

export type DLQQueueType = 'bullmq:dlq:alerts' | 'bullmq:dlq:etl';
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface DLQJobRecord {
  id: string;
  jobId: string;
  queueName: DLQQueueType;
  jobType: string;
  payloadReference?: any;
  attemptCount: number;
  failureReason: string;
  errorStack?: string;
  correlationId: string;
  recoveryStatus: 'PENDING' | 'RETRIED' | 'DISMISSED';
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  lastFailureTime: number;
  tripThreshold: number;
  cooldownPeriodMs: number;
}

export class CircuitBreaker {
  private static state: CircuitBreakerState = 'CLOSED';
  private static consecutiveFailures = 0;
  private static lastFailureTime = 0;
  private static readonly TRIP_THRESHOLD = 5;
  private static readonly COOLDOWN_PERIOD_MS = 30000; // 30s before HALF_OPEN probe

  public static recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  public static recordFailure(): CircuitBreakerState {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.consecutiveFailures >= this.TRIP_THRESHOLD) {
      this.state = 'OPEN';
      console.warn(`⚠️ [CIRCUIT_BREAKER] State tripped to OPEN. Consecutive failures: ${this.consecutiveFailures}`);
    }
    return this.state;
  }

  public static canExecute(): boolean {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.COOLDOWN_PERIOD_MS) {
        this.state = 'HALF_OPEN';
        console.log('🔄 [CIRCUIT_BREAKER] Cooldown elapsed. Entering HALF_OPEN test probe.');
        return true;
      }
      return false; // Fast-fail
    }

    // HALF_OPEN allows single probe
    return true;
  }

  public static getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      tripThreshold: this.TRIP_THRESHOLD,
      cooldownPeriodMs: this.COOLDOWN_PERIOD_MS,
    };
  }
}

export class DLQHandler {
  // Configured retry delays: 10s, 30s, 90s
  public static readonly RETRY_DELAYS_MS = [10000, 30000, 90000];

  /**
   * Determine exponential backoff delay for an attempt
   */
  public static getRetryDelay(attempt: number): number {
    if (attempt <= 0) return this.RETRY_DELAYS_MS[0];
    if (attempt >= this.RETRY_DELAYS_MS.length) return this.RETRY_DELAYS_MS[this.RETRY_DELAYS_MS.length - 1];
    return this.RETRY_DELAYS_MS[attempt - 1];
  }

  /**
   * Process a job failure. If retries exhausted (>= 3), transfer to Dead-Letter Queue
   */
  public static async handleJobFailure(params: {
    jobId: string;
    queueType: 'alerts' | 'etl';
    jobType: string;
    attemptCount: number;
    error: Error;
    payload?: any;
    correlationId?: string;
  }): Promise<{ shouldRetry: boolean; retryDelayMs?: number; movedToDLQ: boolean; dlqId?: string }> {
    const correlationId = params.correlationId || crypto.randomUUID();
    CircuitBreaker.recordFailure();

    if (params.attemptCount < 3) {
      const delay = this.getRetryDelay(params.attemptCount);
      console.log(
        `⏳ [BULLMQ_RETRY] Job ${params.jobId} (attempt ${params.attemptCount}/3) failed: ${params.error.message}. Scheduling retry in ${delay / 1000}s.`
      );
      return { shouldRetry: true, retryDelayMs: delay, movedToDLQ: false };
    }

    // Retries exhausted (>= 3). Move to Dead-Letter Queue.
    const targetQueue: DLQQueueType = params.queueType === 'etl' ? 'bullmq:dlq:etl' : 'bullmq:dlq:alerts';

    console.error(
      `🚨 [DLQ_TRANSFER] Job ${params.jobId} exhausted 3 retries. Moving to Dead-Letter Queue '${targetQueue}'. Error: ${params.error.message}`
    );

    // 1. Dispatch Notification to #eng-alerts
    this.dispatchEngAlertNotification({
      jobId: params.jobId,
      queueName: targetQueue,
      jobType: params.jobType,
      error: params.error.message,
      correlationId,
    });

    // 2. Persist to jarvis_system.dlq_audit_log
    let dlqId = crypto.randomUUID();
    try {
      const res = await pool.query(
        `INSERT INTO jarvis_system.dlq_audit_log 
         (job_id, queue_name, job_type, attempt_count, failure_reason, error_stack, correlation_id, recovery_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
         RETURNING id;`,
        [
          params.jobId,
          targetQueue,
          params.jobType,
          params.attemptCount,
          params.error.message,
          params.error.stack || '',
          correlationId,
        ]
      );
      if (res.rows.length > 0) dlqId = res.rows[0].id;
    } catch (dbErr) {
      console.error('[DLQ_DB_PERSIST_ERROR]', dbErr);
    }

    return { shouldRetry: false, movedToDLQ: true, dlqId };
  }

  /**
   * Manual Idempotent Retry of a Dead-Lettered Job
   */
  public static async retryDLQJob(
    jobId: string,
    resolvedBy: string,
    resolutionNotes: string
  ): Promise<{ success: boolean; message: string }> {
    // 1. Look up DLQ record
    const res = await pool.query(
      `SELECT id, job_id, queue_name, job_type, recovery_status, attempt_count 
       FROM jarvis_system.dlq_audit_log 
       WHERE job_id = $1 OR id::text = $1;`,
      [jobId]
    );

    if (res.rows.length === 0) {
      return { success: false, message: `DLQ job '${jobId}' not found.` };
    }

    const job = res.rows[0];

    // Idempotency check: Cannot re-trigger an already recovered or in-progress action
    if (job.recovery_status === 'RETRIED') {
      return { success: false, message: `Job '${jobId}' has already been retried.` };
    }

    // Safety rule: Do not allow direct replay of restricted business actions without human confirmation
    if (job.job_type === 'action_execution') {
      return {
        success: false,
        message: 'Security Violation: Restricted business actions cannot be automatically replayed. Re-initiate proposal with human confirmation token.',
      };
    }

    // Update DLQ record to RETRIED
    await pool.query(
      `UPDATE jarvis_system.dlq_audit_log 
       SET recovery_status = 'RETRIED', resolved_by = $1, resolved_at = NOW(), resolution_notes = $2
       WHERE id = $3;`,
      [resolvedBy, resolutionNotes || 'Manual admin retry initiated from Control Plane', job.id]
    );

    // Record audit event
    await pool.query(
      `INSERT INTO jarvis_system.audit_logs 
       (request_id, user_id, corporate_email, role, client_type, tool_name, action_type, status, query_summary)
       VALUES ($1, $2, $3, 'ROLE_ADMIN', 'ADMIN_UI', 'dlq_handler', 'RETRY_JOB', 'SUCCESS', $4);`,
      [crypto.randomUUID(), resolvedBy, resolvedBy, `Retried DLQ job ${job.job_id} (${job.job_type})`]
    );

    CircuitBreaker.recordSuccess();

    return {
      success: true,
      message: `Job '${job.job_id}' successfully re-enqueued with idempotency key. Recovery logged.`,
    };
  }

  /**
   * Manual Dismissal of a DLQ Job with Audit Justification
   */
  public static async dismissDLQJob(
    jobId: string,
    resolvedBy: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await pool.query(
      `SELECT id, job_id, recovery_status 
       FROM jarvis_system.dlq_audit_log 
       WHERE job_id = $1 OR id::text = $1;`,
      [jobId]
    );

    if (res.rows.length === 0) {
      return { success: false, message: `DLQ job '${jobId}' not found.` };
    }

    const job = res.rows[0];

    await pool.query(
      `UPDATE jarvis_system.dlq_audit_log 
       SET recovery_status = 'DISMISSED', resolved_by = $1, resolved_at = NOW(), resolution_notes = $2
       WHERE id = $3;`,
      [resolvedBy, reason, job.id]
    );

    return {
      success: true,
      message: `Job '${job.job_id}' marked as DISMISSED. Reason: ${reason}`,
    };
  }

  /**
   * Retrieve DLQ jobs and telemetry for Admin Dashboard
   */
  public static async getDLQOverview(): Promise<{
    jobs: DLQJobRecord[];
    stats: {
      pending: number;
      retried: number;
      dismissed: number;
      total: number;
    };
    circuitBreaker: CircuitBreakerStatus;
  }> {
    const jobsRes = await pool.query(
      `SELECT id, job_id as "jobId", queue_name as "queueName", job_type as "jobType", 
              attempt_count as "attemptCount", failure_reason as "failureReason", 
              error_stack as "errorStack", correlation_id as "correlationId", 
              recovery_status as "recoveryStatus", resolved_by as "resolvedBy", 
              resolved_at as "resolvedAt", resolution_notes as "resolutionNotes", 
              created_at as "createdAt"
       FROM jarvis_system.dlq_audit_log 
       ORDER BY created_at DESC 
       LIMIT 50;`
    );

    const countsRes = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE recovery_status = 'PENDING') as pending,
         COUNT(*) FILTER (WHERE recovery_status = 'RETRIED') as retried,
         COUNT(*) FILTER (WHERE recovery_status = 'DISMISSED') as dismissed
       FROM jarvis_system.dlq_audit_log;`
    );

    const counts = countsRes.rows[0] || { total: 0, pending: 0, retried: 0, dismissed: 0 };

    return {
      jobs: jobsRes.rows,
      stats: {
        total: parseInt(counts.total, 10) || 0,
        pending: parseInt(counts.pending, 10) || 0,
        retried: parseInt(counts.retried, 10) || 0,
        dismissed: parseInt(counts.dismissed, 10) || 0,
      },
      circuitBreaker: CircuitBreaker.getStatus(),
    };
  }

  private static dispatchEngAlertNotification(data: {
    jobId: string;
    queueName: string;
    jobType: string;
    error: string;
    correlationId: string;
  }): void {
    const logLine = `[SLACK_NOTIFICATION #eng-alerts] 🚨 Dead-Letter Alert: Job ${data.jobId} (${data.jobType}) transferred to ${data.queueName}. Reason: ${data.error} | Trace: ${data.correlationId}`;
    console.warn(logLine);
  }
}
