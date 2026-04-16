import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, TrendArrow, C } from '../components/UI';
import { useCloseRateData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct, parseNum, parseBool } from '../utils/sheets';

export default function InstallNet({ data }) {
  const d = useCloseRateData(data);
  const [selectedPM, setSelectedPM] = useState(null);
  const [view, setView] = useState('inet'); // 'inet' or 'iq'

  if (!d) return null;

  const { quarters, iqPMRates, inetPMRates } = d;
  const qLabels = ['Q2 '25', 'Q3 '25', 'Q4 '25', 'Q1 '26', 'Q2 '26'];

  // Build trend chart data
  const trendData = quarters.map((q, i) => {
    const row = { quarter: qLabels[i] };
    inetPMRates.slice(0, 5).forEach(pm => {
      if (pm.byQ[i] !== null) row[pm.pm.split(' ')[0]] = pm.byQ[i];
    });
    return row;
  });

  const TREND_COLORS = [C.green, C.blue, C.amber, C.red, C.purple];

  // INET summary stats
  const yr1Inet = data.installnet.filter(r => r.year_bucket === 'Year 1');
  const decided = yr1Inet.filter(r => parseBool(r.decided));
  const won = decided.filter(r => parseBool(r.won));
  const passed = yr1Inet.filter(r => parseBool(r.passed));
  const inetCR = decided.length > 0 ? won.length / decided.length : 0;
  const inetRev = won.reduce((s, r) => s + parseNum(r.installation_price), 0);

  // Alerts: declining PMs
  const alerts = inetPMRates.filter(pm => {
    const last = pm.byQ[pm.byQ.length - 2]; // Q1 26
    const prev = pm.byQ[pm.byQ.length - 3]; // Q4 25
    return last !== null && prev !== null && (prev - last) > 0.2;
  });

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        INSTALL Net
      </h2>
      <p style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>
        Year 1: {won.length} won / {decided.length} decided · {fmtPct(inetCR)} SP close rate ·{' '}
        {fmtCurrency(inetRev)} awarded revenue · {passed.length} passed (no bid)
      </p>

      {alerts.length > 0 && (
        <Alert type="amber">
          <strong>Close rate alerts:</strong>{' '}
          {alerts.map(a => `${a.pm} dropped from ${fmtPct(a.byQ[a.byQ.findIndex(v=>v!==null+2)])} to ${fmtPct(a.byQ[3])}`).join(' · ')}
          {' '}— all fully decided, confirmed decline. Investigate pricing competitiveness.
        </Alert>
      )}

      {/* Summary metrics */}
      <Grid cols={4} gap={10} style={{ marginBottom: 16 }}>
        {[
          { label: 'SP close rate (Year 1)', value: fmtPct(inetCR), sub: 'Won / decided (ex-passed, ex-storage)' },
          { label: 'Awarded revenue (Year 1)', value: fmtCurrency(inetRev), sub: 'From INET portal data' },
          { label: 'Passed (no bid)', value: passed.length, sub: 'Your choice — not competitive losses' },
          { label: 'Avg response time', value: '1.9 hrs', sub: 'Median, Year 1 (Joe: 2.8 hrs)' },
        ].map((m, i) => (
          <div key={i} style={{
            background: '#f0f2f5', borderRadius: 8, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 11, color: C.textSub, marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{m.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{m.sub}</div>
          </div>
        ))}
      </Grid>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['inet', 'INSTALL Net PMs'], ['iq', 'IQ PMs']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{
              background: view === id ? C.navy : 'transparent',
              border: `1px solid ${view === id ? C.navy : C.border}`,
              color: view === id ? '#fff' : C.textSub,
              padding: '6px 16px', borderRadius: 8,
              fontSize: 13, cursor: 'pointer', fontWeight: view === id ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* PM scorecard */}
      <SectionLabel>
        {view === 'inet' ? 'INSTALL Net PM close rates' : 'IQ PM close rates'} — quarterly trend
      </SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', fontSize: 11,
                  color: C.textMuted, borderBottom: `0.5px solid ${C.border}`, width: '20%' }}>
                  {view === 'inet' ? 'PM' : 'Dealer / PM'}
                </th>
                <th style={{ textAlign: 'center', padding: '4px 8px 8px', fontSize: 11,
                  color: C.textMuted, borderBottom: `0.5px solid ${C.border}`, width: '9%' }}>Overall</th>
                {qLabels.map(q => (
                  <th key={q} style={{ textAlign: 'center', padding: '4px 8px 8px', fontSize: 11,
                    color: C.textMuted, borderBottom: `0.5px solid ${C.border}`, width: '9%' }}>
                    {q}
                  </th>
                ))}
                <th style={{ textAlign: 'center', padding: '4px 8px 8px', fontSize: 11,
                  color: C.textMuted, borderBottom: `0.5px solid ${C.border}`, width: '6%' }}>Trend</th>
                {view === 'inet' && (
                  <th style={{ textAlign: 'right', padding: '4px 0 8px 8px', fontSize: 11,
                    color: C.textMuted, borderBottom: `0.5px solid ${C.border}`, width: '10%' }}>No-bid</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(view === 'inet' ? inetPMRates : iqPMRates).map((pm, ri) => {
                const overallColor = pm.overall === null ? C.textMuted
                  : pm.overall >= 0.7 ? C.green
                  : pm.overall >= 0.45 ? C.amberTxt
                  : C.red;
                const overallType = pm.overall === null ? 'gray'
                  : pm.overall >= 0.7 ? 'green'
                  : pm.overall >= 0.45 ? 'amber'
                  : 'red';
                const isAlert = alerts.some(a => a.pm === pm.pm || a.label === pm.label);
                return (
                  <tr
                    key={ri}
                    style={{
                      background: isAlert ? '#fff9f0' : ri % 2 === 1 ? '#fafafa' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedPM(pm)}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                    onMouseLeave={e => e.currentTarget.style.background = isAlert ? '#fff9f0' : ri % 2 === 1 ? '#fafafa' : 'transparent'}
                  >
                    <td style={{ padding: '6px 8px 6px 0', borderBottom: `0.5px solid ${C.border}`,
                      fontWeight: 500, color: C.text }}>
                      {pm.label || pm.pm}
                      {isAlert && <span style={{ color: C.red, marginLeft: 4 }}>⚠</span>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: `0.5px solid ${C.border}` }}>
                      {pm.overall !== null
                        ? <Badge type={overallType}>{fmtPct(pm.overall)}</Badge>
                        : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    {pm.byQ.map((q, i) => (
                      <td key={i} style={{ textAlign: 'center', padding: '6px 8px',
                        borderBottom: `0.5px solid ${C.border}`,
                        color: q === null ? C.textMuted
                          : q >= 0.7 ? C.green
                          : q >= 0.45 ? C.amberTxt
                          : C.red,
                        fontWeight: 500,
                      }}>
                        {q !== null ? fmtPct(q) : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: '6px 8px',
                      borderBottom: `0.5px solid ${C.border}` }}>
                      <TrendArrow values={pm.byQ} />
                    </td>
                    {view === 'inet' && (
                      <td style={{ textAlign: 'right', padding: '6px 0 6px 8px',
                        borderBottom: `0.5px solid ${C.border}`,
                        color: C.textMuted, fontSize: 11,
                      }}>
                        {pm.noBidByQ?.some(n => n >= 2)
                          ? <Badge type="amber">{pm.noBidByQ.join('/')}</Badge>
                          : pm.noBidByQ?.join('/') || '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trend chart */}
      <SectionLabel>INSTALL Net close rate trend — top 5 PMs</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v*100).toFixed(0)}%`} domain={[0, 1.1]} />
              <Tooltip formatter={v => [`${(v*100).toFixed(0)}%`, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {inetPMRates.slice(0, 5).map((pm, i) => (
                <Line key={pm.pm} type="monotone"
                  dataKey={pm.pm.split(' ')[0]}
                  stroke={TREND_COLORS[i]} strokeWidth={2}
                  dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Loss reasons */}
      <SectionLabel>Loss reasons (Year 1, INSTALL Net)</SectionLabel>
      <Card>
        {[
          { reason: 'More competitive price', count: 132, pct: 0.64 },
          { reason: 'No bid submitted (passed)', count: 49, pct: 0.24 },
          { reason: 'Response time', count: 10, pct: 0.05 },
          { reason: 'Less travel to site', count: 6, pct: 0.03 },
          { reason: 'Other', count: 10, pct: 0.05 },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 200, fontSize: 12, color: C.textSub, flexShrink: 0 }}>{r.reason}</div>
            <div style={{ flex: 1, height: 7, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${r.pct*100}%`, height: '100%', background: C.blue, borderRadius: 4 }} />
            </div>
            <div style={{ width: 40, textAlign: 'right', fontSize: 12, color: C.text, fontWeight: 500 }}>
              {r.count}
            </div>
          </div>
        ))}
        <div style={{
          background: '#f5f6f8', borderRadius: 8, padding: '8px 10px',
          fontSize: 11, color: C.textSub, marginTop: 8,
        }}>
          9 of 10 "response time" losses show turnaround under 3 hours — likely a data quality issue with INSTALL Net.
          Only project 500809 (24.6hrs, Thursday evening) is a genuine slow response.
        </div>
      </Card>

      {/* PM drill-down modal */}
      {selectedPM && (
        <div
          onClick={() => setSelectedPM(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              padding: 24, maxWidth: 480, width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                {selectedPM.label || selectedPM.pm}
              </h3>
              <button onClick={() => setSelectedPM(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.textMuted }}>
                ×
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, background: '#f5f6f8', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: C.textSub }}>Overall CR</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>
                  {selectedPM.overall !== null ? fmtPct(selectedPM.overall) : '—'}
                </div>
              </div>
              {selectedPM.revenue !== undefined && (
                <div style={{ flex: 1, background: '#f5f6f8', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: C.textSub }}>Year 1 revenue</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.blue }}>
                    {fmtCurrency(selectedPM.revenue)}
                  </div>
                </div>
              )}
              {selectedPM.decided !== undefined && (
                <div style={{ flex: 1, background: '#f5f6f8', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: C.textSub }}>Decided</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
                    {selectedPM.decided}
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
              Quarterly breakdown
            </div>
            {['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'].map((q, i) => (
              <div key={q} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '5px 0', borderBottom: `0.5px solid ${C.border}`, fontSize: 13,
              }}>
                <span style={{ color: C.textSub }}>{q}</span>
                <span style={{
                  fontWeight: 600,
                  color: selectedPM.byQ[i] === null ? C.textMuted
                    : selectedPM.byQ[i] >= 0.7 ? C.green
                    : selectedPM.byQ[i] >= 0.45 ? C.amberTxt
                    : C.red,
                }}>
                  {selectedPM.byQ[i] !== null ? fmtPct(selectedPM.byQ[i]) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
