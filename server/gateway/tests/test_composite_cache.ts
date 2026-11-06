import assert from 'assert';
import { CompositeCache } from '../src/cache/composite_cache.js';
import { UserContext } from '../src/security/request_context.js';

async function runCacheTests() {
  console.log('🧪 Starting Composite Semantic Cache Acceptance Suite...');

  const warehouseUser: UserContext = {
    userId: 'USR-WH-01',
    email: 'dave.warehouse@meridian.internal',
    role: 'ROLE_WAREHOUSE',
    department: 'OPERATIONS',
    allowedScopes: ['read:metrics', 'read:knowledge'],
  };

  const salesUser: UserContext = {
    userId: 'USR-SALES-01',
    email: 'sarah.sales@meridian.internal',
    role: 'ROLE_SALES',
    department: 'SALES',
    allowedScopes: ['read:metrics', 'read:knowledge', 'write:quotes'],
  };

  const financeUser: UserContext = {
    userId: 'USR-FIN-01',
    email: 'priya.finance@meridian.internal',
    role: 'ROLE_FINANCE',
    department: 'FINANCE',
    allowedScopes: ['read:metrics', 'read:knowledge', 'read:financials'],
  };

  // 1. Initial lookup -> Miss
  const query1 = 'What is the package intake count for EWR1 today?';
  const miss = await CompositeCache.get(query1, { warehouse: 'EWR1' }, warehouseUser, 'FINANCIAL_METRIC');
  assert.strictEqual(miss.hit, false, 'Initial lookup must be a cache MISS');
  console.log('  ✅ [PASS] Initial query correctly returned MISS');

  // 2. Set cache entry
  const payload1 = { intakeCount: 420, warehouse: 'EWR1' };
  const key1 = await CompositeCache.set(query1, { warehouse: 'EWR1' }, warehouseUser, 'FINANCIAL_METRIC', payload1, 900);
  assert.ok(key1, 'Cache key must be returned');

  // 3. Same authorized query -> Hit (< 100ms)
  const hit = await CompositeCache.get(query1, { warehouse: 'EWR1' }, warehouseUser, 'FINANCIAL_METRIC');
  assert.strictEqual(hit.hit, true, 'Same query and role must produce a HIT');
  assert.deepStrictEqual(hit.data, payload1, 'Cached payload must match exactly');
  assert.ok(hit.latencyMs < 100, `Hit latency (${hit.latencyMs.toFixed(2)}ms) must be < 100ms`);
  console.log(`  ✅ [PASS] Authorized query returned HIT in ${hit.latencyMs.toFixed(2)}ms (< 100ms SLA)`);

  // 4. Changed parameters -> Miss
  const missParams = await CompositeCache.get(query1, { warehouse: 'ONT1' }, warehouseUser, 'FINANCIAL_METRIC');
  assert.strictEqual(missParams.hit, false, 'Changed parameters must produce a MISS');
  console.log('  ✅ [PASS] Changed query parameters correctly returned MISS');

  // 5. Cross-Role Isolation: Sales user trying to access Warehouse-only cached entry -> Miss
  const crossRoleMiss = await CompositeCache.get(query1, { warehouse: 'EWR1' }, salesUser, 'FINANCIAL_METRIC');
  assert.strictEqual(crossRoleMiss.hit, false, 'Sales user cannot access Warehouse role-scoped cache');
  console.log('  ✅ [PASS] Cross-role authorization barrier verified (Sales cannot hit Warehouse cache)');

  // 6. Scope Isolation: Restricted AR Financial query cached by Finance
  const arQuery = 'Show me partner AR aging past 30 days';
  const arPayload = { totalOverdue: 145000 };
  await CompositeCache.set(arQuery, {}, financeUser, 'FINANCIAL_METRIC', arPayload, 900);

  // Warehouse user attempting to query AR cache -> Miss/Deny
  const whArMiss = await CompositeCache.get(arQuery, {}, warehouseUser, 'FINANCIAL_METRIC');
  assert.strictEqual(whArMiss.hit, false, 'Warehouse user lacking read:financials cannot access AR cache');
  console.log('  ✅ [PASS] Scope barrier verified (Warehouse cannot access Finance AR cache)');

  // 7. User-Specific Isolation
  const userQuery = 'What is my personal commission tier?';
  await CompositeCache.set(userQuery, {}, salesUser, 'USER_SPECIFIC', { commissionTier: 'Tier 2' }, 3600);

  const otherSalesUser: UserContext = {
    userId: 'USR-SALES-02',
    email: 'bob.sales@meridian.internal',
    role: 'ROLE_SALES',
    department: 'SALES',
    allowedScopes: ['read:metrics', 'read:knowledge', 'write:quotes'],
  };
  const userIsoMiss = await CompositeCache.get(userQuery, {}, otherSalesUser, 'USER_SPECIFIC');
  assert.strictEqual(userIsoMiss.hit, false, 'User-specific cache must not leak across different user IDs');
  console.log('  ✅ [PASS] User-specific isolation verified (User B cannot access User A private cache)');

  // 8. ETL Watermark Invalidation: Watermark change invalidates financial entries
  const newWatermark = new Date(Date.now() + 60000).toISOString();
  await CompositeCache.advanceETLWatermark(newWatermark);

  const staleMiss = await CompositeCache.get(query1, { warehouse: 'EWR1' }, warehouseUser, 'FINANCIAL_METRIC');
  assert.strictEqual(staleMiss.hit, false, 'Advanced ETL watermark must invalidate financial cache entries');
  console.log('  ✅ [PASS] ETL Watermark synchronization invalidation verified (stale metric prevented)');

  // 9. Verify Stats Reporting
  const stats = CompositeCache.getStats();
  assert.ok(stats.totalRequests >= 5, 'Stats must reflect request counts');
  assert.ok(stats.cacheHits >= 1, 'Stats must count cache hits');
  assert.ok(stats.avgLatencyMs < 50, 'Average latency must be recorded');
  console.log(`  ✅ [PASS] Cache Stats verified: ${stats.cacheHits}/${stats.totalRequests} hits (${stats.hitRatio}%), avg latency: ${stats.avgLatencyMs}ms`);

  console.log('\n🎉 ALL COMPOSITE CACHE ACCEPTANCE TESTS PASSED!\n');
  process.exit(0);
}

runCacheTests().catch((err) => {
  console.error('❌ Cache test failure:', err);
  process.exit(1);
});
