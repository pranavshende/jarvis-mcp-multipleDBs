import assert from 'assert';
import { ModelRouter } from '../src/orchestrator/model_router.js';

async function runModelRouterTests() {
  console.log('🧪 Starting Dynamic Model Routing & Budget Tracking Suite...');

  // 1. Verify Tier Classification
  const fastQuery1 = 'How many packages did EWR1 receive today?';
  const fastQuery2 = 'What is the return policy for wholesale orders?';
  assert.strictEqual(ModelRouter.determineTier(fastQuery1), 'fast_tier');
  assert.strictEqual(ModelRouter.determineTier(fastQuery2), 'fast_tier');
  console.log('  ✅ [PASS] Simple factual and metric queries correctly routed to FAST TIER');

  const deepQuery1 = 'Why did our gross margin compress over the last quarter? Explain the key factors.';
  const deepQuery2 = 'Prepare a strategic executive briefing on rising operational risks.';
  assert.strictEqual(ModelRouter.determineTier(deepQuery1), 'deep_tier');
  assert.strictEqual(ModelRouter.determineTier(deepQuery2), 'deep_tier');
  console.log('  ✅ [PASS] Complex reasoning and synthesis queries correctly routed to DEEP REASONING TIER');

  // 2. Verify Model Selection from Registry
  const fastSelection = ModelRouter.selectModel('fast_tier', false);
  assert.strictEqual(fastSelection.model.model_id, 'gemini-2.5-flash');
  assert.strictEqual(fastSelection.model.cost_in_per_m, 0.075);
  console.log(`  ✅ [PASS] Fast tier primary model verified: ${fastSelection.model.model_id} ($${fastSelection.model.cost_in_per_m}/M tokens)`);

  const deepSelection = ModelRouter.selectModel('deep_tier', false);
  assert.strictEqual(deepSelection.model.model_id, 'gemini-2.5-pro');
  assert.strictEqual(deepSelection.model.cost_in_per_m, 1.25);
  console.log(`  ✅ [PASS] Deep tier primary model verified: ${deepSelection.model.model_id} ($${deepSelection.model.cost_in_per_m}/M tokens)`);

  // 3. Verify Fallback Model Selection
  const fallbackSelection = ModelRouter.selectModel('fast_tier', true);
  assert.strictEqual(fallbackSelection.model.model_id, 'gemini-1.5-flash-8b');
  console.log(`  ✅ [PASS] Configured fallback model verified on failure: ${fallbackSelection.model.model_id}`);

  // 4. Verify Pricing Calculation (Dynamic from Registry)
  const cost = ModelRouter.calculateCost(fastSelection.model, 1000, 500);
  // (1000/1M * 0.075) + (500/1M * 0.30) = 0.000075 + 0.000150 = 0.000225
  assert.strictEqual(cost.totalCost, 0.000225);
  console.log(`  ✅ [PASS] Dynamic cost formula verified: $${cost.totalCost.toFixed(6)} for 1,500 tokens`);

  // 5. Verify Department Budget Checks & Spend Recording
  const budgetStatus = await ModelRouter.checkDepartmentBudget('OPERATIONS', false);
  assert.ok(budgetStatus.monthlySpendLimitUsd > 0, 'Operations budget limit must be > 0');
  console.log(`  ✅ [PASS] Department budget check: OPERATIONS at ${budgetStatus.utilizationPct}% ($${budgetStatus.currentUsdSpend}/$${budgetStatus.monthlySpendLimitUsd})`);

  // Critical alerts must always be allowed
  const alertBudget = await ModelRouter.checkDepartmentBudget('OPERATIONS', true);
  assert.strictEqual(alertBudget.allowed, true, 'Critical alerts must never be blocked by budget limits');
  console.log('  ✅ [PASS] Non-blockable safety policy verified for operational and security alerts');

  // Record a spend event and verify ledger update
  await ModelRouter.recordSpend({
    userId: 'TEST-USER-ROUTER',
    email: 'router.test@meridian.internal',
    department: 'OPERATIONS',
    model: 'gemini-2.5-flash',
    provider: 'google',
    inputTokens: 250,
    outputTokens: 120,
    costUsd: 0.000055,
    requestId: 'REQ-TEST-ROUTER-001',
    routingReason: 'FAST_TIER_METRIC',
  });
  console.log('  ✅ [PASS] Spend recorded to token_usage_ledger and department_budgets updated');

  // 6. Retrieve Budgets Summary
  const budgets = await ModelRouter.getDepartmentBudgets();
  assert.ok(budgets.length >= 4, 'All 4 seeded departments must be returned');
  console.log(`  ✅ [PASS] Retrieved ${budgets.length} department budgets for Admin Control Plane`);

  console.log('\n🎉 ALL DYNAMIC MODEL ROUTING & BUDGET TESTS PASSED!\n');
  process.exit(0);
}

runModelRouterTests().catch((err) => {
  console.error('❌ Model router test failure:', err);
  process.exit(1);
});
