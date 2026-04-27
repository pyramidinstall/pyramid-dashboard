import React, { useState } from 'react';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { useJobsInFlightData } from '../utils/dataHooks';
import { fmtCurrency } from '../utils/sheets';

// ─────────────────────────────────────────────────────────────
// Jobs in Flight — the honesty audit page
// Goal: (1) Nothing valuable falls through the cracks. (2) Kill zombies.
// Structure: stat strip → cleanup queue (hero) → RTI → active work → Skyline
// ─────────────────────────────────────────────────────────────

const TIER_BADGE = {
  'Ready to invoice': 'green',
  'On track': 'green',
  'Slight delay': 'amber',
  'Check in': 'red',
  'Follow up': 'red',
};

function formatPM(pm) {
  if (!pm) return '—';
  return String(pm).split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toISOString().slice(0, 10);
}

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 10,
        padding: '14px 16px', cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = C.text; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || C.text, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Backlog({ data }) {
  const d = useJobsInFlightData(data);
  const [selected, setSelected] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'inprogress' | 'approved'
  const [cleanupSeverity, setCleanupSeverity] = useState('all'); // 'all' | 'high' | 'med' | 'low'

  if (!d) return null;

  // Filter active work
  const activeWorkFiltered = d.activeWork.filter(r => {
    if (activeFilter === 'inprogress') return r.status && r.status.startsWith('In-Progress');
    if (activeFilter === 'approved') return r.status === 'Approved Order';
    return true;
  });

  const cleanupFiltered = d.cleanupQueue.filter(r => {
    if (cleanupSeverity === 'all') return true;
    if (cleanupSeverity === 'needs_po') return r.hasNeedsPO;
    return r.cleanupSeverity === cleanupSeverity;
  });

  // Scroll helper for stat card → section
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Jobs in flight</h2>
      <p style={{ fontSize: 12, color: C.textSub, marginBottom: 14 }}>
        Won jobs pending completion, invoicing, or cleanup. Click any row for detail.
      </p>

      {/* STAT STRIP */}
      <Grid cols={3} gap={10} style={{ marginBottom: 14 }}>
        <StatCard
          label="Likely revenue"
          value={fmtCurrency(d.likelyRevenue)}
          sub="Weighted $ of clean jobs · zombies excluded"
          accent={C.text}
        />
        <StatCard
          label="Needs cleanup"
          value={`${d.cleanupCount} · ${fmtCurrency(d.cleanupFace)}`}
          sub="Suspicious entries · verify in IQ or with Linda"
          accent={d.cleanupCount > 0 ? C.red : C.text}
          onClick={() => scrollTo('cleanup-section')}
        />
        <StatCard
          label="Ready to invoice"
          value={`${d.rtiCount} · ${fmtCurrency(d.rtiFace)}`}
          sub="Your action · send invoices today"
          accent={C.text}
          onClick={() => scrollTo('rti-section')}
        />
      </Grid>

      {/* CLEANUP QUEUE */}
      <div id="cleanup-section">
        <SectionLabel>Cleanup queue — verify, confirm, or close</SectionLabel>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
            These entries triggered at least one honesty check. For each: open the order in IQ, check your email for context, confirm with Linda/PM if needed. These are not auto-closed — review one by one.
          </div>

          {/* Severity filter — includes a dedicated "Needs PO" chase list */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', count: d.cleanupCount },
              { key: 'needs_po', label: 'Needs PO (chase list)', count: d.needsPOCount || 0 },
              { key: 'high', label: 'High priority', count: d.cleanupQueue.filter(r => r.cleanupSeverity === 'high').length },
              { key: 'med', label: 'Medium', count: d.cleanupQueue.filter(r => r.cleanupSeverity === 'med').length },
              { key: 'low', label: 'Data hygiene', count: d.cleanupQueue.filter(r => r.cleanupSeverity === 'low').length },
            ].map(f => {
              const isActive = cleanupSeverity === f.key;
              const isNeedsPO = f.key === 'needs_po';
              const activeColor = isNeedsPO ? C.amber : C.text;
              return (
                <button
                  key={f.key}
                  onClick={() => setCleanupSeverity(f.key)}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    background: isActive ? activeColor : 'transparent',
                    color: isActive ? '#fff' : isNeedsPO ? C.amber : C.textSub,
                    border: `0.5px solid ${isActive ? activeColor : isNeedsPO ? C.amber : C.border}`,
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  {f.label} · {f.count}
                </button>
              );
            })}
          </div>

          {cleanupFiltered.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
              Nothing to clean up here. {cleanupSeverity !== 'all' && 'Try a different filter.'}
            </div>
          ) : (
            <Table
              cols={[
                { key: 'order_number', label: '#', width: '8%',
                  render: v => <span style={{ color: C.textMuted, fontSize: 11 }}>#{v}</span> },
                { key: 'order_name', label: 'Order name', width: '22%',
                  render: (v, r) => v || r.customer || '—' },
                { key: 'customer', label: 'Dealer / PM', width: '17%',
                  render: (_, r) => (
                    <span style={{ fontSize: 11 }}>
                      {r.customer}
                      <br />
                      <span style={{ color: C.textMuted, fontSize: 10 }}>{formatPM(r.pm)}</span>
                    </span>
                  ) },
                { key: 'status', label: 'Status', width: '9%',
                  render: v => <span style={{ fontSize: 10, color: C.textSub }}>{v}</span> },
                { key: 'value', label: 'Remaining', width: '9%',
                  render: v => fmtCurrency(v || 0) },
                { key: 'relevantDate', label: 'Status since', width: '10%',
                  render: (v, r) => {
                    const dateText = fmtDate(v);
                    const statusLabel = r.status === 'Approved Order' ? 'approved'
                                     : r.status.startsWith('In-Progress') ? 'in-progress'
                                     : r.status === 'Ready to Invoice' ? 'RTI'
                                     : '';
                    return (
                      <span style={{ fontSize: 11, color: C.textMuted }}>
                        {dateText}
                        {statusLabel && <><br /><span style={{ fontSize: 9 }}>{statusLabel}</span></>}
                      </span>
                    );
                  } },
                { key: 'cleanupReason', label: 'Why flagged', width: '25%',
                  render: (v, r) => (
                    <span style={{ fontSize: 11,
                      color: r.cleanupSeverity === 'high' ? C.red
                           : r.cleanupSeverity === 'med' ? C.amber
                           : C.textSub,
                      whiteSpace: 'normal',
                      lineHeight: 1.3,
                    }}>
                      {v}
                    </span>
                  ) },
              ]}
              rows={cleanupFiltered}
              onRowClick={setSelected}
            />
          )}
        </Card>
      </div>

      {/* READY TO INVOICE */}
      <div id="rti-section">
        <SectionLabel>Ready to invoice — work complete, your review pending</SectionLabel>
        <Card style={{ marginBottom: 14 }}>
          {d.readyToInvoice.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
              No clean RTI orders in the queue. Check cleanup queue above if something feels missing.
            </div>
          ) : (
            <Table
              cols={[
                { key: 'order_number', label: '#', width: '9%',
                  render: v => <span style={{ color: C.textMuted }}>#{v}</span> },
                { key: 'order_name', label: 'Order name', width: '30%',
                  render: (v, r) => v || r.customer || '—' },
                { key: 'customer', label: 'Dealer / PM', width: '26%',
                  render: (_, r) => (
                    <span style={{ fontSize: 11 }}>
                      {r.customer}
                      <br />
                      <span style={{ color: C.textMuted, fontSize: 10 }}>{formatPM(r.pm)}</span>
                    </span>
                  ) },
                { key: 'value', label: 'Value', width: '13%',
                  render: v => fmtCurrency(v || 0) },
                { key: 'pctInvoiced', label: 'Invoiced %', width: '11%',
                  render: v => {
                    const pct = Math.round((v || 0) * 100);
                    return pct > 0
                      ? <span style={{ fontSize: 11, color: pct >= 50 ? C.green : C.textSub }}>{pct}%</span>
                      : <span style={{ fontSize: 11, color: C.textMuted }}>—</span>;
                  } },
                { key: 'invoiced_date', label: 'Last invoice', width: '11%',
                  render: v => <span style={{ fontSize: 11, color: C.textMuted }}>{v ? fmtDate(v) : '—'}</span> },
              ]}
              rows={d.readyToInvoice}
              onRowClick={setSelected}
              defaultSort={{ key: 'value', dir: 'desc' }}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, fontSize: 11, fontWeight: 600, color: C.text }}>
            Total: {fmtCurrency(d.rtiTotal)} · 95% confidence = {fmtCurrency(d.rtiWeighted)}
          </div>
          <Insight>
            Typical RTI turnover is 1–3 days. Order age shown below ISN'T days-in-RTI (IQ doesn't expose that timestamp yet). Zombie RTIs are detected via other signals and moved to the cleanup queue above.
          </Insight>
        </Card>
      </div>

      {/* ACTIVE WORK — merged In-Progress + Approved */}
      <SectionLabel>Active work — in progress + approved awaiting schedule</SectionLabel>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { key: 'all', label: 'All', count: d.activeWork.length },
            { key: 'inprogress', label: 'In-Progress', count: d.inProgress.length },
            { key: 'approved', label: 'Approved', count: d.approved.length },
          ].map(f => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  background: isActive ? C.text : 'transparent',
                  color: isActive ? '#fff' : C.textSub,
                  border: `0.5px solid ${isActive ? C.text : C.border}`,
                  borderRadius: 4, cursor: 'pointer',
                }}
              >
                {f.label} · {f.count}
              </button>
            );
          })}
        </div>

        {activeWorkFiltered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
            No orders in this view.
          </div>
        ) : (
          <Table
            cols={[
              { key: 'order_number', label: '#', width: '8%',
                render: v => <span style={{ color: C.textMuted }}>#{v}</span> },
              { key: 'order_name', label: 'Order name', width: '25%',
                render: (v, r) => v || r.customer || '—' },
              { key: 'customer', label: 'Dealer / PM', width: '20%',
                render: (_, r) => (
                  <span style={{ fontSize: 11 }}>
                    {r.customer}
                    <br />
                    <span style={{ color: C.textMuted, fontSize: 10 }}>{formatPM(r.pm)}</span>
                  </span>
                ) },
              { key: 'status', label: 'Status', width: '12%',
                render: v => <span style={{ fontSize: 10, color: C.textSub }}>
                  {v === 'In-Progress - Phase Break' ? 'In-Progress (phase)' : v}
                </span> },
              { key: 'value', label: 'Remaining', width: '11%',
                render: v => fmtCurrency(v || 0) },
              { key: 'pctInvoiced', label: 'Invoiced %', width: '9%',
                render: v => {
                  const pct = Math.round((v || 0) * 100);
                  return pct > 0
                    ? <span style={{ fontSize: 11, color: pct >= 80 ? C.green : pct >= 50 ? C.amber : C.textSub }}>{pct}%</span>
                    : <span style={{ fontSize: 11, color: C.textMuted }}>—</span>;
                } },
              { key: 'daysInStatus', label: 'Days', width: '7%',
                render: v => v !== null && v !== undefined ? `${v}d` : '—' },
              { key: 'backlogTier', label: 'Confidence', width: '13%',
                render: v => v ? <Badge type={TIER_BADGE[v] || 'gray'}>{v}</Badge> : '—' },
            ]}
            rows={activeWorkFiltered}
            onRowClick={setSelected}
            defaultSort={{ key: 'daysInStatus', dir: 'asc' }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, fontSize: 11, fontWeight: 600, color: C.text }}>
          In-Progress: {fmtCurrency(d.ipTotal)} ({fmtCurrency(d.ipWeighted)} wtd) · Approved: {fmtCurrency(d.apTotal)} ({fmtCurrency(d.apWeighted)} wtd)
        </div>
        <Insight>
          Sorted by days ascending — jobs closest to completion are on top. "Invoiced %" shows partial-invoice progress. Fully invoiced or $0 remaining entries are in the cleanup queue, not here.
        </Insight>
      </Card>

      {/* SKYLINE — compact single row with real trend */}
      <SectionLabel>Skyline Windows — T&amp;M arrangement (tapering)</SectionLabel>
      <Card style={{ marginBottom: 12 }}>
        <Grid cols={4} gap={10}>
          <div style={{ background: '#f5f6f8', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>Last month invoiced</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{fmtCurrency(d.skylineLastMonth)}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{d.skylineSeries[d.skylineSeries.length - 1]?.label || '—'}</div>
          </div>
          <div style={{ background: '#f5f6f8', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>Trailing 3-mo avg</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{fmtCurrency(d.skylineLast3Avg)}</div>
            <div style={{ fontSize: 10, color: d.skylineTrend < -0.1 ? C.amber : d.skylineTrend > 0.1 ? C.green : C.textMuted }}>
              {d.skylineTrend > 0 ? '+' : ''}{Math.round(d.skylineTrend * 100)}% vs prior 3-mo
            </div>
          </div>
          <div style={{ background: '#f5f6f8', borderRadius: 6, padding: '10px 12px', gridColumn: 'span 2' }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>6-month trend</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
              {d.skylineSeries.map(p => {
                const maxVal = Math.max(...d.skylineSeries.map(x => x.value), 1);
                const h = Math.max(2, (p.value / maxVal) * 36);
                return (
                  <div key={p.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 9, color: C.textMuted }}>{p.value > 0 ? fmtCurrency(p.value) : '—'}</div>
                    <div style={{ width: '100%', height: h, background: d.skylineDeclining ? C.amber : '#5DCAA5', borderRadius: 2 }} />
                    <div style={{ fontSize: 9, color: C.textMuted }}>{p.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Grid>
        {d.skylineDeclining && (
          <Insight>
            Trending downward — the T&amp;M arrangement is tapering as expected. The Overview page&rsquo;s forecast models this as a fixed $30K remaining; revisit that assumption if the trend changes.
          </Insight>
        )}
      </Card>

      {/* DETAIL MODAL */}
      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={() => setSelected(null)}>
          {[
            ['Order name', selected.order_name || '—'],
            ['Customer', selected.customer],
            ['PM', formatPM(selected.pm)],
            ['Status', selected.status],
            ['Grand total', fmtCurrency(selected.gt)],
            ['PO #', selected.po_number || '—'],
            ['PO amount', selected.po_amount ? fmtCurrency(parseFloat(selected.po_amount) || 0) : '—'],
            ['Authorization method', selected.auth_method || '—'],
            ['Dollars invoiced', fmtCurrency(parseFloat(selected.dollars_invoiced) || 0)],
            ['Invoiced %', selected.pctInvoiced !== undefined ? `${Math.round(selected.pctInvoiced * 100)}%` : '—'],
            ['Remaining', fmtCurrency(selected.value || selected.remaining || 0)],
            ['Created date', fmtDate(selected.created_date)],
            ['Approved date', fmtDate(selected.approved_start_date)],
            ['In-progress date', fmtDate(selected.inprog_start_date)],
            ['Days in status', selected.daysInStatus !== null && selected.daysInStatus !== undefined ? `${selected.daysInStatus} days` : '—'],
            ['Confidence tier', selected.backlogTier || '—'],
            ['Weighted value', fmtCurrency(selected.backlogWeighted || 0)],
            ...(selected.cleanupReasons && selected.cleanupReasons.length > 0
              ? [['Cleanup flags', (
                  <div>
                    {selected.cleanupReasons.map((f, i) => (
                      <div key={i} style={{
                        fontSize: 11,
                        color: f.severity === 'high' ? C.red : f.severity === 'med' ? C.amber : C.textSub,
                        marginBottom: 2,
                      }}>• {f.reason}</div>
                    ))}
                  </div>
                )]]
              : []),
            ...(selected.modification_notes ? [['Notes', selected.modification_notes]] : []),
          ].map(([k, v]) => <DetailRow key={k} label={k} value={v} />)}
        </Modal>
      )}
    </div>
  );
}