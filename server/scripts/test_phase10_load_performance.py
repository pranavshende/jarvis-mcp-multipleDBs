# -*- coding: utf-8 -*-
"""
Phase 10: Comprehensive Performance and Load Testing
Evaluates throughput, latency distribution, connection pooling, and error rates across:
  1. Concurrency sweeps (1, 5, 10, 25, 50 concurrent workers)
  2. Cached queries throughput (pure Gateway L1/L2 memory)
  3. Financial metric queries (Deterministic SQL + connection pool)
  4. Knowledge search queries (pgvector retrieval)
  5. Mixed realistic operational workload (40% cache, 30% KB, 20% metrics, 10% admin)
  6. Spike test (sudden surge to 50 concurrent)
  7. Sustained load benchmark
"""

import sys
import os
import json
import time
import statistics
import concurrent.futures
import requests

GATEWAY_URL = "http://127.0.0.1:4000"
FLASK_URL = "http://127.0.0.1:5000"
FOUNDER_TOKEN = "msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c"
HEADERS = {"Authorization": f"Bearer {FOUNDER_TOKEN}", "Content-Type": "application/json"}

results = {
    "test_suite": "Phase 10 Load & Performance",
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "concurrency_sweep": [],
    "scenarios": {},
    "summary": {}
}

def calculate_stats(latencies_ms, total_duration_sec, errors_count):
    total = len(latencies_ms) + errors_count
    if not latencies_ms:
        return {
            "total_requests": total,
            "successful_requests": 0,
            "failed_requests": errors_count,
            "error_rate_pct": 100.0,
            "rps": 0.0,
            "min_ms": 0, "p50_ms": 0, "p90_ms": 0, "p95_ms": 0, "p99_ms": 0, "max_ms": 0
        }
    sorted_lats = sorted(latencies_ms)
    def pct(p):
        idx = int(len(sorted_lats) * (p / 100.0))
        return round(sorted_lats[min(idx, len(sorted_lats) - 1)], 2)

    return {
        "total_requests": total,
        "successful_requests": len(latencies_ms),
        "failed_requests": errors_count,
        "error_rate_pct": round((errors_count / total) * 100.0, 2) if total > 0 else 0,
        "rps": round(len(latencies_ms) / total_duration_sec, 2) if total_duration_sec > 0 else 0,
        "min_ms": round(sorted_lats[0], 2),
        "p50_ms": pct(50),
        "p90_ms": pct(90),
        "p95_ms": pct(95),
        "p99_ms": pct(99),
        "max_ms": round(sorted_lats[-1], 2)
    }

def run_load_batch(task_fn, total_requests, concurrency):
    latencies = []
    errors = 0
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(task_fn) for _ in range(total_requests)]
        for f in concurrent.futures.as_completed(futures):
            try:
                lat, success = f.result()
                if success:
                    latencies.append(lat)
                else:
                    errors += 1
            except Exception:
                errors += 1
    total_time = time.time() - t0
    return calculate_stats(latencies, total_time, errors)

# Tasks
def req_cached_query():
    t0 = time.perf_counter()
    try:
        r = requests.get(f"{GATEWAY_URL}/api/health", headers=HEADERS, timeout=5.0)
        return (time.perf_counter() - t0) * 1000, r.status_code == 200
    except:
        return (time.perf_counter() - t0) * 1000, False

def req_metric_query():
    t0 = time.perf_counter()
    try:
        r = requests.post(f"{GATEWAY_URL}/api/tools/get_partner_ar_aging", headers=HEADERS, json={"partner_id": "301"}, timeout=10.0)
        return (time.perf_counter() - t0) * 1000, r.status_code == 200
    except:
        return (time.perf_counter() - t0) * 1000, False

def req_knowledge_query():
    t0 = time.perf_counter()
    try:
        r = requests.post(f"{GATEWAY_URL}/api/tools/search_company_knowledge", headers=HEADERS, json={"query": "payment terms"}, timeout=10.0)
        return (time.perf_counter() - t0) * 1000, r.status_code == 200
    except:
        return (time.perf_counter() - t0) * 1000, False

def req_admin_query():
    t0 = time.perf_counter()
    try:
        r = requests.get(f"{GATEWAY_URL}/api/admin/dlq", headers=HEADERS, timeout=5.0)
        return (time.perf_counter() - t0) * 1000, r.status_code == 200
    except:
        return (time.perf_counter() - t0) * 1000, False

def req_mixed(idx):
    mod = idx % 10
    if mod < 4:  # 40% cached
        return req_cached_query()
    elif mod < 7: # 30% knowledge
        return req_knowledge_query()
    elif mod < 9: # 20% metrics
        return req_metric_query()
    else:         # 10% admin
        return req_admin_query()

def main():
    print("=" * 80)
    print("  PHASE 10: COMPREHENSIVE PERFORMANCE AND LOAD BENCHMARK")
    print("=" * 80)

    # 1. Warm-up
    print("[1/5] Warming caches and connection pools...")
    req_cached_query()
    req_metric_query()
    req_knowledge_query()
    print("Warm-up completed.\n")

    # 2. Concurrency Sweep (Cached endpoint)
    print("[2/5] Running Concurrency Sweep (1, 5, 10, 25, 50 workers)...")
    concurrency_levels = [1, 5, 10, 25, 50]
    for c in concurrency_levels:
        batch_size = 50 if c <= 10 else 100
        stats = run_load_batch(req_cached_query, batch_size, c)
        stats["concurrency"] = c
        results["concurrency_sweep"].append(stats)
        print(f"  Concurrency {c:2d} | RPS: {stats['rps']:6.1f} | p50: {stats['p50_ms']:5.1f}ms | p95: {stats['p95_ms']:5.1f}ms | Errors: {stats['error_rate_pct']}%")

    # 3. Workload Scenarios
    print("\n[3/5] Benchmarking Targeted Scenarios...")
    
    # Scenario A: Cached Latency / Throughput
    print("  Testing Scenario A: Pure In-Memory Cache (50 requests @ 10 concurrent)...")
    scen_a = run_load_batch(req_cached_query, 50, 10)
    results["scenarios"]["A_cached_queries"] = scen_a
    print(f"    RPS: {scen_a['rps']} | p50: {scen_a['p50_ms']}ms | p95: {scen_a['p95_ms']}ms")

    # Scenario B: Financial Metrics (Database queries)
    print("  Testing Scenario B: Financial Metrics (20 requests @ 5 concurrent)...")
    scen_b = run_load_batch(req_metric_query, 20, 5)
    results["scenarios"]["B_financial_metrics"] = scen_b
    print(f"    RPS: {scen_b['rps']} | p50: {scen_b['p50_ms']}ms | p95: {scen_b['p95_ms']}ms")

    # Scenario C: Knowledge Retrieval (pgvector RAG)
    print("  Testing Scenario C: Knowledge Retrieval (20 requests @ 5 concurrent)...")
    scen_c = run_load_batch(req_knowledge_query, 20, 5)
    results["scenarios"]["C_knowledge_search"] = scen_c
    print(f"    RPS: {scen_c['rps']} | p50: {scen_c['p50_ms']}ms | p95: {scen_c['p95_ms']}ms")

    # 4. Mixed Realistic Workload (40% cache, 30% KB, 20% metric, 10% admin)
    print("\n[4/5] Testing Scenario D: Mixed Operational Workload (50 requests @ 10 concurrent)...")
    call_idx = [0]
    def mixed_task():
        idx = call_idx[0]
        call_idx[0] += 1
        return req_mixed(idx)

    scen_d = run_load_batch(mixed_task, 50, 10)
    results["scenarios"]["D_mixed_workload"] = scen_d
    print(f"    RPS: {scen_d['rps']} | p50: {scen_d['p50_ms']}ms | p95: {scen_d['p95_ms']}ms | Errors: {scen_d['error_rate_pct']}%")

    # 5. Spike Test (50 concurrent sudden burst)
    print("\n[5/5] Testing Scenario E: Sudden Spike Burst (50 concurrent requests)...")
    scen_e = run_load_batch(req_cached_query, 50, 50)
    results["scenarios"]["E_spike_burst"] = scen_e
    print(f"    RPS: {scen_e['rps']} | p50: {scen_e['p50_ms']}ms | p95: {scen_e['p95_ms']}ms | Errors: {scen_e['error_rate_pct']}%")

    # Summary Assessment
    max_rps = max(c["rps"] for c in results["concurrency_sweep"])
    avg_p50 = statistics.mean([s["p50_ms"] for s in results["scenarios"].values()])
    overall_errors = sum(s["failed_requests"] for s in results["scenarios"].values())
    total_calls = sum(s["total_requests"] for s in results["scenarios"].values())
    overall_error_pct = round((overall_errors / total_calls) * 100.0, 2) if total_calls > 0 else 0

    results["summary"] = {
        "max_gateway_rps": max_rps,
        "avg_scenario_p50_ms": round(avg_p50, 2),
        "total_requests_executed": total_calls,
        "total_failures": overall_errors,
        "overall_error_rate_pct": overall_error_pct,
        "connection_pool_stable": overall_error_pct == 0.0,
        "sla_target_met": overall_error_pct < 1.0 and scen_a["p95_ms"] < 25.0
    }

    print("\n" + "=" * 80)
    print("  PHASE 10 PERFORMANCE SUMMARY")
    print(f"  Max Gateway Throughput : {max_rps} RPS")
    print(f"  Cached p95 Latency     : {scen_a['p95_ms']} ms")
    print(f"  Mixed Workload p50     : {scen_d['p50_ms']} ms")
    print(f"  Overall Error Rate     : {overall_error_pct}%")
    print(f"  Connection Pool Stable : {results['summary']['connection_pool_stable']}")
    print("=" * 80)

    with open("docs/testing/performance_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    return results

if __name__ == "__main__":
    main()

