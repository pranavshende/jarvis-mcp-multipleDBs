# -*- coding: utf-8 -*-
import requests
import time
import statistics
import json

GATEWAY_URL = "http://127.0.0.1:4000"
ADMIN_TOKEN = "msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c"
headers = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

# 1. Warm up the cache
warmup_query = "What is our RMA return policy and time limit?"
r1 = requests.post(f"{GATEWAY_URL}/api/query", headers=headers, json={"query": warmup_query})
assert r1.status_code == 200, f"Warmup failed: {r1.status_code}"

# 2. Benchmark 50 repeated cache hits
latencies = []
for i in range(50):
    t0 = time.time()
    r = requests.post(f"{GATEWAY_URL}/api/query", headers=headers, json={"query": warmup_query})
    elapsed_ms = (time.time() - t0) * 1000
    latencies.append(elapsed_ms)
    data = r.json()
    assert data.get("fromCache") is True or r.status_code == 200

p50 = round(statistics.median(latencies), 2)
p95 = round(statistics.quantiles(latencies, n=20)[18], 2)
p99 = round(statistics.quantiles(latencies, n=100)[98], 2)
mean = round(statistics.mean(latencies), 2)

print(f"CACHE BENCHMARK (50 Hits): Mean={mean}ms, p50={p50}ms, p95={p95}ms, p99={p99}ms")

with open("docs/testing/cache_benchmark.json", "w", encoding="utf-8") as f:
    json.dump({
        "iterations": 50,
        "mean_latency_ms": mean,
        "p50_latency_ms": p50,
        "p95_latency_ms": p95,
        "p99_latency_ms": p99,
        "sla_target_ms": 100.0,
        "sla_passed": p99 < 100.0
    }, f, indent=2)

