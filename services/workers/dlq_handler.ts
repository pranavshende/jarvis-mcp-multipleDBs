// Re-export DLQHandler from server/gateway/src/workers/dlq_handler.ts
export {
  DLQHandler,
  CircuitBreaker,
  DLQQueueType,
  CircuitBreakerState,
  DLQJobRecord,
  CircuitBreakerStatus,
} from '../../server/gateway/src/workers/dlq_handler.js';
