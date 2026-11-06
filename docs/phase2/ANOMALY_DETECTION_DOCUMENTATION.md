# Jarvis v1 — Statistical Anomaly Detection Engine

## 1. Mathematical Methodology

The Statistical Anomaly Detection Engine (`server/services/rules/anomaly_detector.py`) uses a rolling 14-day baseline window to evaluate warehouse operational volatility without relying on static arbitrary thresholds.

Both parametric (Z-Score) and non-parametric (Interquartile Range) methods are computed simultaneously:

### 1.1 Parametric Analysis: Z-Score
$$Z = \frac{X - \mu}{\sigma}$$
Where:
- $\mu$: Sample mean over rolling 14-day history: $\mu = \frac{1}{N}\sum_{i=1}^N X_i$
- $\sigma$: Sample standard deviation: $\sigma = \sqrt{\frac{1}{N-1}\sum_{i=1}^N (X_i - \mu)^2}$
- Alert Trigger:
  - $|Z| \ge 2.0$: **WARNING** Anomaly
  - $|Z| \ge 3.0$: **CRITICAL** Anomaly

### 1.2 Non-Parametric Analysis: Interquartile Range (IQR)
- $Q_1$: 25th percentile
- $Q_3$: 75th percentile
- $\text{IQR} = Q_3 - Q_1$
- Lower Outlier Fence: $Q_1 - 1.5 \times \text{IQR}$
- Upper Outlier Fence: $Q_3 + 1.5 \times \text{IQR}$

---

## 2. Monitored Metrics & Live Baselines

### 2.1 Daily Inspection Failure Rate
- **Target Schema**: `analytics.fact_inspections`
- **Formula**: $\frac{\sum \text{qty\_failed}}{\sum \text{qty\_received}} \times 100$
- **14-Day Baseline**:
  - Sample Size: 14 days
  - Mean ($\mu$): **8.07%**
  - Standard Deviation ($\sigma$): **7.67%**
  - Median: **4.45%**
  - IQR Fence: $[-5.18\%, 16.68\%]$
- **Latest Evaluation (2026-10-20)**:
  - Daily Failure Rate: **5.32%** (10 failed of 188 received)
  - Z-Score: **-0.36**
  - Status: **NORMAL** (Within 1 $\sigma$)

---

### 2.2 Daily Dock Scan Volume
- **Target Schema**: `analytics.fact_dock_receipts`
- **Formula**: $\text{COUNT}(*)$ inbound packages checked in per day
- **14-Day Baseline**:
  - Sample Size: 14 days
  - Mean ($\mu$): **51.79 scans**
  - Standard Deviation ($\sigma$): **22.46 scans**
  - Median: **52.5 scans**
  - IQR Fence: $[25.0, 81.0]$ scans
- **Latest Evaluation (2026-10-20)**:
  - Daily Scan Volume: **7.0 scans**
  - Z-Score: **-1.99**
  - IQR Outlier: **TRUE (Below Lower Fence 25.0)**
  - Status: **WARNING_ANOMALY** (Volume Drop)
  - Alert Emitted: `DOCK_SCAN_VOLUME_ANOMALY`
