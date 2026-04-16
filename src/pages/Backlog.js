import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, C } from '../components/UI';
import { useBacklogData } from '../utils/dataHooks';
import { fmtCurrency, parseNum } from '../utils/sheets';

const TIER_COLORS = {
  'Imminent': C.green, 'On track': C.green,
  'Slight delay': C.amber, 'Check in': C.red, 'Follow up': C.red,
};

const TIER_BADGE = {
  'Imminent': 'green', 'On track': 'green',
  'Slight delay': 'amber', 'Check in': 'red', 'Follow up': 'red',
};

export default function Backlog({ data }) {
  const d = useBacklogData(data);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  if (!d) return null;

  const totalFace = d.backlog.reduce((s, r) => s + parseNum(r.remaining_to_invoice || r.grand_total), 0);
  const totalWeighted = d.backlog.reduce((s, r) => s + parseNum(r.weighted_backlog || 0), 0);

  const filteredBacklog = selectedTier
    ? d.backlog.filter(r => r.backlog_conf_tier === selectedTier)
    : d.backlog;

  const pieData = d.byTier.filter(t => t.value > 0);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        Approved &amp; In-Progress Orders
      </h2>
      <p style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>
        Won jobs pending invoice · {d.backlog.length} orders ·{' '}
        {fmtCurrency(totalFace)} face · {fmtCurrency(totalWeighted)} confidence-weighted
      </p>

      <Alert type="blue">
        Once a PO is received, delays are out of your control — site readiness or product lead time.
        These timing flags are for awareness only. Click any tier below to drill into those specific orders.
      </Alert>

      <Grid cols={2} gap={10} style={{ marginBottom: 16 }}>
        {/* Donut */}
        <Card>
          <CardTitle>By timing confidence — click to drill down</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ height: 160, width: 160, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="tier"
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70}
                    paddingAngle={2}
                    onClick={e => setSelectedTier(selectedTier === e.tier ? null : e.tier)}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={TIER_COLORS[entry.tier] || C.gray}
                        opacity={selectedTier && selectedTier !== entry.tier ? 0.3 : 1}
                        stroke={selectedTier === entry.tier ? '#fff' : 'none'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={v => [fmtCurrency(v, false), '']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {d.byTier.filter(t => t.value > 0).map(t => (
                <button
                  key={t.tier}
                  onClick={() => setSelectedTier(selectedTier === t.tier ? null : t.tier)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', background: selectedTier === t.tier ? '#f0f7ff' : 'transparent',
                    border: `1px solid ${selectedTier === t.tier ? TIER_COLORS[t.tier] : C.border}`,
                    borderRadius: 6, padding: '5px 8px', marginBottom: 5,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: TIER_COLORS[t.tier], flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{t.tier}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: TIER_COLORS[t.tier] }}>
                    {fmtCurrency(t.value)}
                  </span>
                </button>
              ))}
              {selectedTier && (
                <button
                  onClick={() => setSelectedTier(null)}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.textSub, padding: '4px 8px', borderRadius: 6,
                    fontSize: 11, cursor: 'pointer', marginTop: 4,
                  }}
                >
                  Show all ×
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Check-in alerts */}
        <Card>
          <CardTitle>Check-in alerts — sitting beyond P75 timing</CardTitle>
          <Table
            cols={[
              { key: 'order_number', label: '#', width: '12%' },
              { key: 'customer', label: 'Customer', width: '30%' },
              { key: 'remaining_to_invoice', label: 'Value', width: '16%',
                render: (v, row) => fmtCurrency(parseNum(v || row.grand_total)) },
              { key: 'days_in_status', label: 'Age', width: '14%',
                render: v => {
                  const n = parseNum(v);
                  return <Badge type={n > 180 ? 'red' : 'amber'}>{n}d</Badge>;
                }},
              { key: 'backlog_conf_tier', label: 'Note', width: '28%',
                render: v => <Badge type={TIER_BADGE[v] || 'gray'}>{v}</Badge> },
            ]}
            rows={d.alerts}
            onRowClick={setSelectedOrder}
          />
          <div style={{
            background: '#f5f6f8', borderRadius: 8,
            padding: '8px 10px', fontSize: 11,
            color: C.textSub, marginTop: 8,
          }}>
            Delays are out of your control once PO received. Flag = awareness only. Confirm status quarterly.
          </div>
        </Card>
      </Grid>

      {/* All backlog */}
      <SectionLabel>
        All approved &amp; in-progress orders
        {selectedTier ? ` — ${selectedTier} (${filteredBacklog.length} orders)` : ` (${d.backlog.length} orders)`}
      </SectionLabel>
      <Card>
        <Table
          cols={[
            { key: 'order_number', label: '#', width: '8%' },
            { key: 'customer', label: 'Customer', width: '22%' },
            { key: 'pm', label: 'PM', width: '16%' },
            { key: 'status', label: 'Status', width: '16%' },
            { key: 'remaining_to_invoice', label: 'Remaining', width: '12%',
              render: (v, row) => fmtCurrency(parseNum(v || row.grand_total)) },
            { key: 'backlog_conf_tier', label: 'Confidence', width: '13%',
              render: v => <Badge type={TIER_BADGE[v] || 'gray'}>{v}</Badge> },
            { key: 'backlog_confidence', label: 'Disc.', width: '7%',
              render: v => v ? `${(parseNum(v)*100).toFixed(0)}%` : '—' },
            { key: 'days_in_status', label: 'Days', width: '6%' },
          ]}
          rows={filteredBacklog}
          onRowClick={setSelectedOrder}
        />
      </Card>

      {/* Order detail modal */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
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
                Order #{selectedOrder.order_number}
              </h3>
              <button onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.textMuted }}>
                ×
              </button>
            </div>
            {[
              ['Customer', selectedOrder.customer],
              ['PM / Contact', selectedOrder.pm],
              ['Status', selectedOrder.status],
              ['Grand total', fmtCurrency(parseNum(selectedOrder.grand_total), false)],
              ['Already invoiced', fmtCurrency(parseNum(selectedOrder.dollars_invoiced || 0), false)],
              ['Remaining', fmtCurrency(parseNum(selectedOrder.remaining_to_invoice || selectedOrder.grand_total), false)],
              ['Confidence tier', selectedOrder.backlog_conf_tier],
              ['Confidence discount', selectedOrder.backlog_confidence ? `${(parseNum(selectedOrder.backlog_confidence)*100).toFixed(0)}%` : '—'],
              ['Weighted value', fmtCurrency(parseNum(selectedOrder.weighted_backlog || 0), false)],
              ['Approved date', selectedOrder.approved_start_date || '—'],
              ['In-progress date', selectedOrder.inprog_start_date || '—'],
              ['Days in status', selectedOrder.days_in_status ? `${selectedOrder.days_in_status} days` : '—'],
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
