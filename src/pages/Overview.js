import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Card, CardTitle, MetricCard, SectionLabel, Grid,
  Alert, Badge, Funnel, C, Table,
} from '../components/UI';
import { useOverviewData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct, parseNum } from '../utils/sheets';

export default function Overview({ data }) {
  const d = useOverviewData(data);
  const [drillTier, setDrillTier] = useState(null);

  if (!d) return null;

  const gap = 3000000 - d.yr1Rev;
  const yr2Gap = 3000000 - d.yr2Rev;

  // Backlog drill-down
  const backlogOrders = data.orders.filter(r => r.is_backlog === 'TRUE');
  const filteredBacklog = drillTier
    ? backlogOrders.filter(r => r.backlog_conf_tier === drillTier)
    : backlogOrders;

  const tierColors = {
    'Imminent': C.green, 'On track': C.green,
    'Slight delay': C.amber, 'Check in': C.red, 'Follow up': C.red,
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            Pyramid Office Solutions — Owner Dashboard
          </h1>
          <p style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
            Jordan Bass · Year 2: Apr 1, 2026 – Mar 31, 2027 · $3M target
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.amber }}>Day 8</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>of Year 2</div>
        </div>
      </div>

      <Alert type="blue">
        Year 1 final: <strong>{fmtCurrency(d.yr1Rev)}</strong>. Year 2 at{' '}
        <strong>{fmtCurrency(d.yr2Rev)}</strong> collected — early days.{' '}
        Combined forward visibility:{' '}
        <strong>{fmtCurrency(d.totalForwardWeighted)}</strong> weighted across
        backlog + pipeline.
      </Alert>

      {/* Metric cards */}
      <Grid cols={4} gap={10} style={{ marginBottom: 16 }}>
        <MetricCard
          label="Year 1 Final"
          value={fmtCurrency(d.yr1Rev)}
          sub="Apr 2025 – Mar 2026"
        />
        <MetricCard
          label="Year 2 Collected"
          value={fmtCurrency(d.yr2Rev)}
          sub="Apr 1, 2026 onwards"
          color={C.textMuted}
        />
        <MetricCard
          label="Year 2 Target"
          value="$3.0M"
          sub={`Gap: ${fmtCurrency(yr2Gap)}`}
          color={C.text}
        />
        <MetricCard
          label="Projected at Current Pace"
          value="$1.87M"
          sub="Gap to $3M: $1.13M"
          color={C.amber}
        />
      </Grid>

      {/* Revenue engines */}
      <SectionLabel>Revenue engines — projected annual at current pace</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        {[
          { label: 'Total at current pace', sub: 'All engines combined', val: 1873000, color: C.green, pct: 62 },
          { label: 'INSTALL Net', sub: '$40K/mo · 77.8% SP close rate', val: 485000, color: C.blue, pct: 55 },
          { label: 'Non-INET base (XS/S/M)', sub: '~$50K/mo · CoV 0.49 · most predictable', val: 606000, color: C.purple, pct: 68 },
          { label: 'Non-INET large (L cohort)', sub: '~$55K/mo · CoV 0.74 · primary growth lever', val: 662000, color: C.amber, pct: 74 },
          { label: 'Skyline Windows (T&M)', sub: '~4 months remaining at ~$10K/mo', val: null, color: C.gray, pct: 13, valLabel: '~$40K rem.' },
          { label: 'XL jobs ($50K+, non-INET)', sub: 'Not in projection — see Pipeline page', val: null, color: C.red, pct: 5, valLabel: 'Upside only', dashed: true },
        ].map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8,
            border: `0.5px ${e.dashed ? 'dashed' : 'solid'} ${C.border}`,
            marginBottom: 6, opacity: e.dashed ? 0.7 : 1,
            background: i === 0 ? '#f5f6f8' : 'transparent',
          }}>
            <div style={{ width: 180, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{e.label}</div>
              <div style={{ fontSize: 11, color: C.textSub }}>{e.sub}</div>
            </div>
            <div style={{ flex: 1, height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden', maxWidth: 120 }}>
              <div style={{ width: `${e.pct}%`, height: '100%', background: e.color, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, width: 80, textAlign: 'right', flexShrink: 0 }}>
              {e.valLabel || fmtCurrency(e.val)}
            </div>
          </div>
        ))}
      </Card>

      {/* Forward visibility funnels */}
      <SectionLabel>Forward visibility — backlog + pipeline</SectionLabel>
      <Grid cols={2} gap={10} style={{ marginBottom: 0 }}>
        <Funnel
          title="Pipeline — open quotes"
          stages={[
            {
              label: 'All open quotes (face value)',
              value: d.pipelineFace, displayValue: fmtCurrency(d.pipelineFace),
              color: '#B5D4F4',
              arrow: 'weighted by PM / dealer / cohort close rate — 39% effective',
            },
            {
              label: 'Realistic expected revenue',
              value: d.pipelineWeighted, displayValue: fmtCurrency(d.pipelineWeighted),
              color: C.green,
              insight: `INET $1.12M → $483K · Non-INET $1.30M → $457K. AFD 16% CR and Maffucci 3.8% CR drive most of the discount.`,
            },
          ]}
        />
        <Funnel
          title="Backlog — approved & in-progress"
          stages={[
            {
              label: 'All won jobs (face value)',
              value: d.backlogFace, displayValue: fmtCurrency(d.backlogFace),
              color: '#C0DD97',
              arrow: 'confidence-weighted for timing risk — 83% retained',
            },
            {
              label: 'Realistic expected revenue',
              value: d.backlogWeighted, displayValue: fmtCurrency(d.backlogWeighted),
              color: C.green,
              insight: null,
            },
          ]}
        />
      </Grid>

      {/* Backlog tier breakdown */}
      <div style={{
        display: 'flex', gap: 16, padding: '10px 16px',
        marginBottom: 8,
      }}>
        {Object.entries(d.tierMap).map(([tier, val]) => (
          <button
            key={tier}
            onClick={() => setDrillTier(drillTier === tier ? null : tier)}
            style={{
              background: drillTier === tier ? tierColors[tier] : 'transparent',
              border: `1px solid ${tierColors[tier]}`,
              color: drillTier === tier ? '#fff' : tierColors[tier],
              padding: '4px 10px', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {tier}: {fmtCurrency(val)}
          </button>
        ))}
        {drillTier && (
          <button
            onClick={() => setDrillTier(null)}
            style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.textSub, padding: '4px 10px', borderRadius: 6,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            Clear filter ×
          </button>
        )}
      </div>

      {/* Backlog drill-down table */}
      {drillTier && (
        <Card style={{ marginBottom: 16 }}>
          <CardTitle>Backlog — {drillTier} ({filteredBacklog.length} orders)</CardTitle>
          <Table
            cols={[
              { key: 'order_number', label: '#', width: '8%' },
              { key: 'customer', label: 'Customer', width: '28%' },
              { key: 'pm', label: 'PM', width: '18%' },
              { key: 'remaining_to_invoice', label: 'Remaining', width: '13%',
                render: v => fmtCurrency(parseNum(v)) },
              { key: 'backlog_conf_tier', label: 'Tier', width: '13%',
                render: v => <Badge type={['Check in','Follow up'].includes(v) ? 'red' : v === 'Slight delay' ? 'amber' : 'green'}>{v}</Badge> },
              { key: 'days_in_status', label: 'Days in status', width: '12%' },
              { key: 'status', label: 'Status', width: '18%' },
            ]}
            rows={filteredBacklog}
          />
        </Card>
      )}

      {/* Combined total */}
      <div style={{
        background: '#fff', border: `2px solid ${C.green}`,
        borderRadius: 12, padding: '14px 20px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16, marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 3 }}>
            Combined forward visibility
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            Pipeline {fmtCurrency(d.pipelineWeighted)} + Backlog {fmtCurrency(d.backlogWeighted)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Face value</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.textSub }}>
              {fmtCurrency(d.totalForwardFace)}
            </div>
          </div>
          <div style={{ fontSize: 20, color: C.textMuted }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Weighted (realistic)</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>
              {fmtCurrency(d.totalForwardWeighted)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Of $3M target</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.amber }}>
              {fmtPct(d.totalForwardWeighted / 3000000)}
            </div>
          </div>
        </div>
      </div>

      {/* Concentration */}
      <SectionLabel>Customer concentration — Year 1 revenue</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
          Red line = 20% threshold. INSTALL Net at 41.6% is structural concentration.
        </div>
        {d.concentration.map((c, i) => {
          const pct = c.pct;
          const maxPct = 0.5;
          const fillW = Math.min(pct / maxPct * 100, 100);
          const textColor = pct > 0.2 ? C.redTxt : pct > 0.1 ? C.amberTxt : C.grayTxt;
          const fillColor = pct > 0.2 ? C.red : pct > 0.1 ? C.amber : '#5DCAA5';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{
                fontSize: 12, color: C.textSub, width: 155,
                flexShrink: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.customer}
              </div>
              <div style={{
                flex: 1, height: 18, background: '#f0f2f5',
                borderRadius: 3, overflow: 'hidden', position: 'relative',
              }}>
                <div style={{ width: `${fillW}%`, height: '100%', background: fillColor, borderRadius: 3 }} />
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${20 / 50 * 100}%`, width: 1, background: C.red,
                }} />
                <span style={{
                  position: 'absolute', right: 4, top: '50%',
                  transform: 'translateY(-50%)', fontSize: 11,
                  fontWeight: 600, color: textColor,
                }}>
                  {(pct * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
        {/* Axis */}
        <div style={{ display: 'flex', marginLeft: 163, marginTop: 4, position: 'relative', height: 14 }}>
          {[0, 10, 20, 30, 40, 50].map(t => (
            <span key={t} style={{
              position: 'absolute', left: `${t / 50 * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: t === 20 ? C.red : C.textMuted,
              fontWeight: t === 20 ? 600 : 400,
            }}>
              {t === 20 ? '20% ←' : `${t}%`}
            </span>
          ))}
        </div>
      </Card>

      {/* Monthly revenue chart */}
      <SectionLabel>Year 1 monthly revenue — reference baseline</SectionLabel>
      <Card>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.monthly} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${Math.round(v/1000)}K`} />
              <Tooltip formatter={v => [fmtCurrency(v, false), 'Revenue']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {d.monthly.map((_, i) => <Cell key={i} fill={C.blue} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{
          background: '#f5f6f8', borderRadius: 8, padding: '8px 10px',
          fontSize: 11, color: C.textSub, marginTop: 8,
        }}>
          Year 1: {fmtCurrency(d.yr1Rev)}. Spikes from large INET jobs. Non-INET base avg ~$90K/mo.
          Mar low = year-end invoices not yet collected.
        </div>
      </Card>
    </div>
  );
}
