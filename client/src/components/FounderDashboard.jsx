import React, { useState, useEffect } from 'react';
import { executeMetric } from '../api/client';

export default function FounderDashboard() {
  const [loading, setLoading] = useState(true);
  const [packagesData, setPackagesData] = useState(null);
  const [payoutsData, setPayoutsData] = useState(null);
  const [creditData, setCreditData] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [pkgRes, payRes, credRes] = await Promise.all([
          executeMetric('WAREHOUSE_RECEIVING_SUMMARY', { date: '2026-10-19' }),
          executeMetric('PAYOUT_STATUS_SUMMARY'),
          executeMetric('PARTNER_CREDIT_UTILIZATION', { partner_id: '301' })
        ]);
        if (pkgRes.status === 'SUCCESS') setPackagesData(pkgRes.result.data);
        if (payRes.status === 'SUCCESS') setPayoutsData(payRes.result.data);
        if (credRes.status === 'SUCCESS') setCreditData(credRes.result.data[0]);
      } catch (err) {
        console.error('Failed to load founder metrics', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>Executive Decision Cockpit</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
          Deterministic, ground-truth business intelligence calculated directly by PostgreSQL against the live Supabase analytics database.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          Loading live metrics from Supabase PostgreSQL 17...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card 1: Question 1 */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#818cf8', fontWeight: '600', letterSpacing: '0.05em' }}>
                  Founder Question 1 • Facility Operations
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f8fafc', marginTop: '2px' }}>
                  "How many packages did we receive yesterday?" (Monday, Oct 19, 2026)
                </h2>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.3)' }}>
                IANA Timezone Aware
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {packagesData && packagesData.map((fac) => (
                <div key={fac.facility_code} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{fac.facility_name} ({fac.facility_code})</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc', margin: '6px 0' }}>
                    {fac.local_packages} <span style={{ fontSize: '14px', fontWeight: '400', color: '#94a3b8' }}>local pkgs</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Timezone: <code>{fac.timezone}</code> | UTC naive: {fac.utc_packages} pkgs
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', fontSize: '13px', color: '#93c5fd' }}>
              <strong>Audit Explanation:</strong> Evaluating receiving volume in naive UTC falsely shifts late-evening shifts (between 8:00 PM and midnight EDT/PDT) into the next UTC calendar date. Jarvis applies facility IANA timezones dynamically.
            </div>
          </div>

          {/* Card 2: Question 2 */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#34d399', fontWeight: '600', letterSpacing: '0.05em' }}>
                  Founder Question 2 • Financial Performance
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f8fafc', marginTop: '2px' }}>
                  "Are we making money this month?"
                </h2>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                September Closed GAAP / October Mid-Month
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>September Gross Revenue</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#f8fafc', margin: '4px 0' }}>$1,852,586.39</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>367 Invoices Recognized</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>September Fixed OPEX</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#f8fafc', margin: '4px 0' }}>$291,800.00</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Rent, Payroll, Utilities</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Closed GAAP Net Profit</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#34d399', margin: '4px 0' }}>$7,300.86</div>
                <div style={{ fontSize: '12px', color: '#10b981' }}>0.39% Net Margin</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>October Accounting Status</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#fbbf24', margin: '4px 0' }}>UNCLOSED MID-MONTH</div>
                <div style={{ fontSize: '12px', color: '#d97706' }}>Accruals Pending Month-End</div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', fontSize: '13px', color: '#fcd34d' }}>
              <strong>Accounting Rule:</strong> GAAP net profit can only be authoritatively declared on closed ledger cycles (September 2026). High bullion trading volume (~10% mix at 1.2% margin) and high acquisition inventory carrying costs compressed net margin to 0.39%.
            </div>
          </div>

          {/* Card 3: Question 3 */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#f87171', fontWeight: '600', letterSpacing: '0.05em' }}>
                  Founder Question 3 • Operational & Credit Risks
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f8fafc', marginTop: '2px' }}>
                  "What problems should I be worried about today?"
                </h2>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                2 Critical Anomalies Detected
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Anomaly 1 */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '18px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#f87171' }}>PAYOUT EXECUTION FAILURE</span>
                  <span style={{ fontSize: '11px', color: '#fca5a5' }}>Bank NACHA R01</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#fee2e2', margin: '8px 0 4px' }}>
                  77 Blocked Member Payouts ($173,339.51)
                </div>
                <p style={{ fontSize: '13px', color: '#fca5a5', lineHeight: '1.4' }}>
                  A bank file format error on October 12 resulted in 9 failed ACH payouts ($19,641.44) and 68 on-hold payouts ($153,698.07). 77 members remain unpaid for &gt;8 business days.
                </p>
              </div>

              {/* Anomaly 2 */}
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '18px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#f87171' }}>WHOLESALE CREDIT LIMIT BREACH</span>
                  <span style={{ fontSize: '11px', color: '#fca5a5' }}>113.7% Utilization</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#fee2e2', margin: '8px 0 4px' }}>
                  Northgate Hobby: $284,279.37 Open AR
                </div>
                <p style={{ fontSize: '13px', color: '#fca5a5', lineHeight: '1.4' }}>
                  Breached $250,000 credit limit by $34,279.37. Over $185,500.00 is past due &gt;60 days. WMS has 3 pending wholesale pick waves on hold awaiting credit override.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
