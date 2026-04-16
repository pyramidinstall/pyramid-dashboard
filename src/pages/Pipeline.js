import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, C } from '../components/UI';
import { usePipelineData } from '../utils/dataHooks';
import { fmtCurrency, parseNum } from '../utils/sheets';

export default function Pipeline({ data }) {
  const d = usePipelineData(data);
  const [cohortFilter, setCohortFilter] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  if (!d) return null;

  const COHORT_COLORS = {
    'XS <$1K': C.purple, 'S $1K-5K': C.blue,
    'M $5K-15K': C.green, 'L $15K-50K': C.amber, 'XL $50K+': C.red,
  };

  const filteredOpen = cohortFilter
    ? d.allOpen.filter(r => r.cohort === cohortFilter)
    : d.allOpen;

  const totalFace = d.allOpen.reduce((s, r) => s + parseNum(r.grand_total), 0);
  const totalWeighted = d.allOpen.reduce((s, r) => s + parseNum(r.weighted_backlog || 0), 0);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        Pipeline
      </h2>
      <p style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>
        {d.allOpen.length} open quotes · {fmtCurrency(totalFace)} face · {fmtCurrency(totalWeighted)} weighted
      </p>

      <Alert type="amber">
        Pipeline face value ({fmtCurrency(totalFace)}) vs weighted ({fmtCurrency(totalWeighted)}) — 65% discount.
        Maffucci ($228K face → $9K weighted, no history) and AFD ($200K face → $32K weighted, 16% CR) account for most of the gap.
        Don't plan off face value.
      </Alert>

      {/* Cohort chart */}
      <SectionLabel>Open pipeline by cohort — face vs weighted</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.byCohort} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <XAxis dataKey="cohort" tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.textMuted }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${Math.round(v / 1000)}K`} />
              <Tooltip formatter={v => [fmtCurrency(v, false), '']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="face" name="Face value" fill={C.blue} radius={[3, 3, 0, 0]}
                onClick={e => setCohortFilter(cohortFilter === e.cohort ? null : e.cohort)} />
              <Bar dataKey="weighted" name="Weighted" fill={C.green} radius={[3, 3, 0, 0]}
                onClick={e => setCohortFilter(cohortFilter === e.cohort ? null : e.cohort)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {d.byCohort.map(c => (
            <button key={c.cohort}
              onClick={() => setCohortFilter(cohortFilter === c.cohort ? null : c.cohort)}
              style={{
                background: cohortFilter === c.cohort ? COHORT_COLORS[c.cohort] : 'transparent',
                border: `1px solid ${COHORT_COLORS[c.cohort]}`,
                color: cohortFilter === c.cohort ? '#fff' : COHORT_COLORS[c.cohort],
                padding: '3px 10px', borderRadius: 6,
                fontSize: 11, cursor: 'pointer',
              }}>
              {c.cohort}
            </button>
          ))}
          {cohortFilter && (
            <button onClick={() => setCohortFilter(null)}
              style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.textSub, padding: '3px 10px', borderRadius: 6,
                fontSize: 11, cursor: 'pointer',
              }}>
              Clear ×
            </button>
          )}
        </div>
      </Card>

      {/* Expiry alerts */}
      {(d.expiryAlerts.length > 0 || d.recentlyExpired.length > 0) && (
        <>
          <SectionLabel>Quote expiry alerts — L+ quotes ($15K+)</SectionLabel>
          <Alert type="red">
            <strong>{fmtCurrency(d.recentlyExpired.reduce((s,r) => s + parseNum(r.grand_total), 0))} in recently expired L+ quotes need follow-up.</strong>
            {' '}Whalen #12150 BAT Works ($249.5K) confirmed Q1 2027 target. Systems Source #12236 ($78K) expired recently.
          </Alert>
          <Grid cols={2} gap={10} style={{ marginBottom: 16 }}>
            <Card>
              <CardTitle>Expiring within 30 days</CardTitle>
              <Table
                cols={[
                  { key: 'order_number', label: '#', width: '12%' },
                  { key: 'customer', label: 'Customer', width: '35%' },
                  { key: 'grand_total', label: 'Value', width: '18%',
                    render: v => fmtCurrency(parseNum(v)) },
                  { key: 'days_to_expiry', label: 'Days left', width: '18%',
                    render: v => <Badge type={parseNum(v) <= 14 ? 'red' : 'amber'}>{v}d</Badge> },
                ]}
                rows={d.expiryAlerts}
                onRowClick={setSelectedQuote}
              />
            </Card>
            <Card>
              <CardTitle>Recently expired — follow up to close out or reissue</CardTitle>
              <Table
                cols={[
                  { key: 'order_number', label: '#', width: '12%' },
                  { key: 'customer', label: 'Customer', width: '35%' },
                  { key: 'grand_total', label: 'Value', width: '18%',
                    render: v => fmtCurrency(parseNum(v)) },
                  { key: 'days_to_expiry', label: 'Expired', width: '20%',
                    render: v => <Badge type="amber">{Math.abs(parseNum(v))}d ago</Badge> },
                ]}
                rows={d.recentlyExpired}
                onRowClick={setSelectedQuote}
              />
            </Card>
          </Grid>
        </>
      )}

      {/* Large job nurture table */}
      <SectionLabel>Large job nurture table — $25K+ open quotes</SectionLabel>
      <Alert type="amber">
        {d.nurture.length} quotes · {fmtCurrency(d.nurture.reduce((s,r)=>s+parseNum(r.grand_total),0))} face ·{' '}
        {fmtCurrency(d.nurture.reduce((s,r)=>s+parseNum(r.weighted_backlog||0),0))} weighted.
        XL jobs not in base projection — wins are upside. L-cohort quotes partially reflected via close rate.
      </Alert>
      <Card style={{ marginBottom: 16 }}>
        <Table
          cols={[
            { key: 'order_number', label: '#', width: '8%' },
            { key: 'customer', label: 'Customer', width: '20%' },
            { key: 'pm', label: 'PM', width: '15%' },
            { key: 'grand_total', label: 'Face', width: '11%',
              render: v => fmtCurrency(parseNum(v)) },
            { key: 'cohort', label: 'Tier', width: '9%',
              render: v => <Badge type={v?.includes('XL') ? 'red' : 'amber'}>{v?.includes('XL') ? 'XL' : 'L'}</Badge> },
            { key: 'backlog_confidence', label: 'CR', width: '8%',
              render: v => v ? `${(parseNum(v)*100).toFixed(0)}%` : '—' },
            { key: 'weighted_backlog', label: 'Weighted', width: '11%',
              render: (v, row) => {
                const n = parseNum(v);
                const color = n > 20000 ? C.green : n > 8000 ? C.amberTxt : C.red;
                return <span style={{ color }}>{fmtCurrency(n)}</span>;
              }},
            { key: 'days_presented', label: 'Age', width: '7%',
              render: v => v ? `${v}d` : '—' },
            { key: 'days_to_expiry', label: 'Expires', width: '8%',
              render: v => {
                if (!v) return '—';
                const n = parseNum(v);
                if (n < 0) return <Badge type="gray">expired</Badge>;
                if (n <= 21) return <Badge type="red">{n}d</Badge>;
                if (n <= 45) return <Badge type="amber">{n}d</Badge>;
                return `${n}d`;
              }},
          ]}
          rows={d.nurture}
          onRowClick={setSelectedQuote}
        />
      </Card>

      {/* All open quotes */}
      <SectionLabel>All open quotes{cohortFilter ? ` — ${cohortFilter}` : ''}</SectionLabel>
      <Card>
        <Table
          cols={[
            { key: 'order_number', label: '#', width: '8%' },
            { key: 'customer', label: 'Customer', width: '22%' },
            { key: 'pm', label: 'PM', width: '16%' },
            { key: 'channel', label: 'Channel', width: '10%',
              render: v => <Badge type={v === 'INSTALL Net' ? 'blue' : 'gray'}>{v === 'INSTALL Net' ? 'INET' : 'IQ'}</Badge> },
            { key: 'grand_total', label: 'Face', width: '11%',
              render: v => fmtCurrency(parseNum(v)) },
            { key: 'cohort', label: 'Cohort', width: '10%' },
            { key: 'weighted_backlog', label: 'Weighted', width: '11%',
              render: v => fmtCurrency(parseNum(v)) },
            { key: 'days_to_expiry', label: 'Expires', width: '8%',
              render: v => {
                if (!v) return '—';
                const n = parseNum(v);
                if (n <= 14) return <Badge type="red">{n}d</Badge>;
                if (n <= 30) return <Badge type="amber">{n}d</Badge>;
                return `${n}d`;
              }},
          ]}
          rows={filteredOpen}
          onRowClick={setSelectedQuote}
        />
      </Card>

      {/* Quote detail modal */}
      {selectedQuote && (
        <div
          onClick={() => setSelectedQuote(null)}
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
                Order #{selectedQuote.order_number}
              </h3>
              <button onClick={() => setSelectedQuote(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.textMuted }}>
                ×
              </button>
            </div>
            {[
              ['Customer', selectedQuote.customer],
              ['PM / Contact', selectedQuote.pm],
              ['Salesperson', selectedQuote.salesperson],
              ['Status', selectedQuote.status],
              ['Face value', fmtCurrency(parseNum(selectedQuote.grand_total), false)],
              ['Cohort', selectedQuote.cohort],
              ['Close rate used', selectedQuote.backlog_confidence ? `${(parseNum(selectedQuote.backlog_confidence)*100).toFixed(0)}%` : '—'],
              ['Weighted value', fmtCurrency(parseNum(selectedQuote.weighted_backlog || 0), false)],
              ['Presented', selectedQuote.lqp_start_date || '—'],
              ['Days presented', selectedQuote.days_presented ? `${selectedQuote.days_presented} days` : '—'],
              ['Expires', selectedQuote.expiry_date || '—'],
              ['Days to expiry', selectedQuote.days_to_expiry ? `${selectedQuote.days_to_expiry} days` : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: `0.5px solid ${C.border}`,
                fontSize: 13,
              }}>
                <span style={{ color: C.textSub }}>{k}</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
