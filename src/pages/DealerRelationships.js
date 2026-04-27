import React, { useState, useMemo } from 'react';
import { Card, SectionLabel, Grid, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { useRelationshipData } from '../utils/dataHooks';
import { fmtCurrency } from '../utils/sheets';

// ─────────────────────────────────────────────────────────────
// Dealer Relationships — PM-centric, channel-agnostic
// Goal: spot cooling/heating PMs early; suggest pricing posture for live quoting.
// Three sections: Action list (3 tabs) → PM Scorecard (lookup table) → Single-PM dealers + New sources
// ─────────────────────────────────────────────────────────────

function formatPM(pm) {
  if (!pm) return '—';
  return String(pm).split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function fmtLastQuote(daysAgo, date) {
  if (daysAgo === null || daysAgo === undefined) return '—';
  if (daysAgo < 30) return `${daysAgo}d ago`;
  if (!date) return `${daysAgo}d ago`;
  const d = new Date(date);
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  const yy = String(d.getFullYear()).slice(-2);
  // For dates 6+ months old, show "Mon 'YY" so the year is unambiguous
  if (daysAgo >= 180) {
    return `${monthName} '${yy}`;
  }
  // 30 days to 6 months: "Mon D 'YY"
  return `${monthName} ${d.getDate()} '${yy}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  const monthName = dt.toLocaleDateString('en-US', { month: 'short' });
  const yy = String(dt.getFullYear()).slice(-2);
  return `${monthName} ${dt.getDate()} '${yy}`;
}

// Status badge with color
function StatusBadge({ status }) {
  const map = {
    cold: { type: 'red', label: 'Cold' },
    cooling: { type: 'amber', label: 'Cooling' },
    new: { type: 'blue', label: 'New' },
    hot: { type: 'green', label: 'Hot' },
    steady: { type: 'gray', label: 'Steady' },
    reactivation: { type: 'gray', label: 'Reactivate' },
  };
  const cfg = map[status] || { type: 'gray', label: status };
  return <Badge type={cfg.type}>{cfg.label}</Badge>;
}

// Suggested pricing badge
function PricingBadge({ pricing }) {
  const map = {
    Aggressive: { bg: '#FAEEDA', color: '#412402' },
    Premium: { bg: '#E1F5EE', color: '#04342C' },
    Market: { bg: '#F1EFE8', color: '#2C2C2A' },
  };
  const cfg = map[pricing] || map.Market;
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px',
      background: cfg.bg, color: cfg.color,
      borderRadius: 3, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{pricing}</span>
  );
}

// Channel badge (small)
function ChannelBadge({ channels }) {
  if (!channels || channels.length === 0) return null;
  if (channels.includes('INET') && channels.length === 1) {
    return (
      <span style={{
        fontSize: 9, padding: '1px 5px', background: '#EEEDFE',
        color: '#26215C', borderRadius: 3, fontWeight: 600,
      }}>INET</span>
    );
  }
  if (channels.includes('Non-INET') && channels.length === 1) {
    return null; // non-INET is the default, no badge needed
  }
  // Mixed: both
  return (
    <span style={{
      fontSize: 9, padding: '1px 5px', background: '#EEEDFE',
      color: '#26215C', borderRadius: 3, fontWeight: 600,
    }}>+ INET</span>
  );
}

// Velocity delta (last 30 vs prior 30) — most recent number first
function VelocityDelta({ last, prior }) {
  const arrow = last > prior ? '↑' : last < prior ? '↓' : '→';
  const color = last > prior ? C.green : last < prior ? C.red : C.textMuted;
  return (
    <span style={{ fontSize: 11, color: C.textSub, whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600, color: C.text }}>{last}</span>
      <span style={{ color: C.textMuted }}> (was {prior})</span>
      <span style={{ color, fontWeight: 600, marginLeft: 4 }}>{arrow}</span>
    </span>
  );
}

export default function DealerRelationships({ data }) {
  const d = useRelationshipData(data);
  const [actionTab, setActionTab] = useState('cold');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPM, setSelectedPM] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [includeINET, setIncludeINET] = useState(false); // default off — INET data is stale until recurring report lands

  // Apply INET filter to all derived lists
  const excludeINET = (pm) => !pm.channels.includes('INET') || pm.channels.includes('Non-INET');
  const goingCold = useMemo(() => includeINET ? (d?.goingCold || []) : (d?.goingCold || []).filter(excludeINET), [d, includeINET]);
  const cooling = useMemo(() => includeINET ? (d?.cooling || []) : (d?.cooling || []).filter(excludeINET), [d, includeINET]);
  const heatingUp = useMemo(() => includeINET ? (d?.heatingUp || []) : (d?.heatingUp || []).filter(excludeINET), [d, includeINET]);
  const reactivation = useMemo(() => includeINET ? (d?.reactivation || []) : (d?.reactivation || []).filter(excludeINET), [d, includeINET]);
  const newSourcesFiltered = useMemo(() =>
    includeINET ? (d?.newSources || []) : (d?.newSources || []).filter(s => s.dealer !== 'INSTALL Net'),
  [d, includeINET]);

  const filteredPMs = useMemo(() => {
    if (!d) return [];
    return d.pmList.filter(p => {
      // Reactivation candidates live in their own section — exclude unless user explicitly filters for them
      if (p.status === 'reactivation' && statusFilter !== 'reactivation') return false;
      // INET toggle
      if (!includeINET && p.channels.includes('INET') && !p.channels.includes('Non-INET')) {
        return false;
      }
      if (channelFilter !== 'all') {
        if (channelFilter === 'inet' && !p.channels.includes('INET')) return false;
        if (channelFilter === 'noninet' && !p.channels.includes('Non-INET')) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [d, includeINET, channelFilter, statusFilter]);

  if (!d) return null;

  // Action list: get rows for current tab
  const actionRows =
    actionTab === 'cold' ? goingCold :
    actionTab === 'cooling' ? cooling :
    heatingUp;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Dealer relationships</h2>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: 11, color: C.textSub, userSelect: 'none', flexShrink: 0,
        }}>
          <input
            type="checkbox"
            checked={includeINET}
            onChange={e => setIncludeINET(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Include INET PMs
          <span style={{ color: C.textMuted, fontSize: 10, marginLeft: 2 }}>
            (off — INET data is stale until recurring report lands)
          </span>
        </label>
      </div>
      <p style={{ fontSize: 12, color: C.textSub, marginBottom: 18, marginTop: 4 }}>
        PMs and dealers across all channels · use mid-quote to gauge pricing posture · click any row for history
      </p>

      {/* ── ACTION LIST ───────────────────────────────────────────────── */}
      <SectionLabel>Action list — PMs that need attention</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        {/* Three stat cards / tab switchers */}
        <Grid cols={3} gap={10} style={{ marginBottom: 14 }}>
          <ActionStatCard
            label="Going cold"
            count={goingCold.length}
            sub="No quote in 14 days to 6 months"
            color={C.red}
            active={actionTab === 'cold'}
            onClick={() => setActionTab('cold')}
          />
          <ActionStatCard
            label="Cooling"
            count={cooling.length}
            sub="Velocity below personal baseline"
            color={C.amber}
            active={actionTab === 'cooling'}
            onClick={() => setActionTab('cooling')}
          />
          <ActionStatCard
            label="Heating up"
            count={heatingUp.length}
            sub="Velocity above personal baseline"
            color={C.green}
            active={actionTab === 'hot'}
            onClick={() => setActionTab('hot')}
          />
        </Grid>

        {actionRows.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
            {actionTab === 'cold' && 'No PMs going cold. Good.'}
            {actionTab === 'cooling' && 'No PMs cooling off. Quote velocity is healthy.'}
            {actionTab === 'hot' && 'No PMs heating up right now. Watch this space.'}
          </div>
        ) : (
          <Table
            cols={[
              { key: 'pm', label: 'PM / Dealer', width: '26%',
                render: (_, r) => (
                  <span style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{formatPM(r.pm)}</span>
                    <br />
                    <span style={{ color: C.textSub, fontSize: 11 }}>
                      {r.dealer} · {fmtCurrency(r.avgValue)} avg
                    </span>
                  </span>
                ) },
              { key: 'totalQuotes', label: 'Lifetime', width: '14%',
                render: (_, r) => (
                  <span style={{ fontSize: 11 }}>
                    {r.totalQuotes} quotes
                    <br />
                    <span style={{ color: C.textSub, fontSize: 10 }}>
                      {fmtCurrency(r.revenueWon)} won
                    </span>
                  </span>
                ) },
              { key: 'daysSinceLastQuote', label: 'Last quote', width: '12%',
                render: (v, r) => (
                  <span style={{ fontSize: 11,
                    color: r.status === 'cold' ? C.red : C.textSub }}>
                    {fmtLastQuote(v, r.lastQuoteDate)}
                  </span>
                ) },
              { key: 'velocityDelta', label: 'Last 30d vs prior', width: '15%',
                render: (_, r) => <VelocityDelta last={r.last30Count} prior={r.prior30Count} /> },
              { key: 'whatChanged', label: 'What changed', width: '23%',
                render: (_, r) => (
                  <span style={{ fontSize: 11, color: C.textSub }}>
                    {whatChangedText(r)}
                  </span>
                ) },
              { key: 'suggestedPricing', label: 'Suggested pricing', width: '10%',
                render: v => <PricingBadge pricing={v} /> },
            ]}
            rows={actionRows}
            onRowClick={setSelectedPM}
          />
        )}
        <Insight>
          Click any row for full history, recent wins/losses, and open quotes. &ldquo;What changed&rdquo; describes the velocity shift compared to this PM&rsquo;s personal baseline.
        </Insight>
      </Card>

      {/* ── PM SCORECARD ──────────────────────────────────────────────── */}
      <SectionLabel>PM scorecard — full lookup · click any row for history</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        {/* Filter row — text search comes from Table's built-in input */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            style={{
              fontSize: 12, padding: '5px 10px',
              border: `0.5px solid ${C.border}`, borderRadius: 4,
              background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="all">All channels</option>
            <option value="noninet">Non-INET</option>
            <option value="inet">INET</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              fontSize: 12, padding: '5px 10px',
              border: `0.5px solid ${C.border}`, borderRadius: 4,
              background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="all">All statuses</option>
            <option value="hot">Hot</option>
            <option value="steady">Steady</option>
            <option value="cooling">Cooling</option>
            <option value="cold">Cold</option>
            <option value="new">New</option>
            <option value="reactivation">Reactivate</option>
          </select>
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>
            {filteredPMs.length} active PMs · {(d?.reactivation?.length || 0)} silent in Reactivation below
          </span>
        </div>

        {filteredPMs.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
            No PMs match the filters.
          </div>
        ) : (
          <Table
            cols={[
              { key: 'pm', label: 'PM / Dealer', width: '23%',
                render: (_, r) => (
                  <span style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{formatPM(r.pm)}</span>
                    {' '}<ChannelBadge channels={r.channels} />
                    <br />
                    <span style={{ color: C.textSub, fontSize: 11 }}>{r.dealer}</span>
                  </span>
                ) },
              { key: 'totalQuotes', label: 'Total', width: '8%',
                render: v => <span style={{ fontSize: 11 }}>{v}</span> },
              { key: 'velocityDelta', label: 'Last 30d vs prior', width: '15%',
                render: (_, r) => <VelocityDelta last={r.last30Count} prior={r.prior30Count} /> },
              { key: 'avgValue', label: 'Avg $', width: '9%',
                render: v => <span style={{ fontSize: 11 }}>{fmtCurrency(v)}</span> },
              { key: 'lifetimeCR', label: 'CR', width: '10%',
                render: (v, r) => v !== null
                  ? <span style={{ fontSize: 11 }}>
                      {Math.round(v * 100)}%
                      {r.crEroded && <span style={{ color: C.red, marginLeft: 3 }}>↓</span>}
                    </span>
                  : <span style={{ fontSize: 11, color: C.textMuted }}>—</span> },
              { key: 'daysSinceLastQuote', label: 'Last quote', width: '10%',
                render: (v, r) => (
                  <span style={{ fontSize: 11,
                    color: r.status === 'cold' ? C.red : C.textSub }}>
                    {fmtLastQuote(v, r.lastQuoteDate)}
                  </span>
                ) },
              { key: 'status', label: 'Status', width: '11%',
                render: v => <StatusBadge status={v} /> },
              { key: 'suggestedPricing', label: 'Suggested pricing', width: '14%',
                render: v => <PricingBadge pricing={v} /> },
            ]}
            rows={filteredPMs}
            onRowClick={setSelectedPM}
            defaultSort={{ key: 'totalQuotes', dir: 'desc' }}
          />
        )}
      </Card>

      {/* ── REACTIVATION CANDIDATES ──────────────────────────────────── */}
      <SectionLabel>Reactivation candidates — silent 6+ months, worth reviving</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.textSub, marginTop: 0, marginBottom: 10 }}>
          PMs who used to send us business but have gone quiet for 6+ months. They already know us — easier to reactivate than to find new ones. Sorted by historical revenue.
        </p>
        {reactivation.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
            No long-silent PMs to reactivate.
          </div>
        ) : (
          <Table
            cols={[
              { key: 'pm', label: 'PM / Dealer', width: '28%',
                render: (_, r) => (
                  <span style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{formatPM(r.pm)}</span>
                    <br />
                    <span style={{ color: C.textSub, fontSize: 11 }}>{r.dealer}</span>
                  </span>
                ) },
              { key: 'totalQuotes', label: 'Lifetime', width: '14%',
                render: (_, r) => (
                  <span style={{ fontSize: 11 }}>
                    {r.totalQuotes} quotes
                    <br />
                    <span style={{ color: C.textSub, fontSize: 10 }}>
                      {fmtCurrency(r.revenueWon)} won
                    </span>
                  </span>
                ) },
              { key: 'lifetimeCR', label: 'Lifetime CR', width: '12%',
                render: v => v !== null
                  ? <span style={{ fontSize: 11 }}>{Math.round(v * 100)}%</span>
                  : <span style={{ fontSize: 11, color: C.textMuted }}>—</span> },
              { key: 'daysSinceLastQuote', label: 'Silent for', width: '14%',
                render: (v) => {
                  const months = Math.floor(v / 30);
                  return <span style={{ fontSize: 11, color: C.textSub }}>
                    {months} months
                  </span>;
                } },
              { key: 'lastQuoteDate', label: 'Last quote', width: '14%',
                render: v => <span style={{ fontSize: 11, color: C.textMuted }}>{fmtDate(v)}</span> },
              { key: 'avgValue', label: 'Avg quote', width: '10%',
                render: v => <span style={{ fontSize: 11 }}>{fmtCurrency(v)}</span> },
              { key: 'suggestedPricing', label: 'Suggested pricing', width: '10%',
                render: v => <PricingBadge pricing={v} /> },
            ]}
            rows={reactivation}
            onRowClick={setSelectedPM}
            defaultSort={{ key: 'revenueWon', dir: 'desc' }}
          />
        )}
      </Card>

      {/* ── SINGLE-PM DEALERS ─────────────────────────────────────────── */}
      <SectionLabel>Single-PM dealers — sourcing prompts</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.textSub, marginTop: 0, marginBottom: 10 }}>
          Active dealers (≥$25K won, 3+ jobs) where you only have 1 PM relationship — opportunities to expand. Schedule a meeting.
        </p>
        {d.singlePMDealers.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
            No single-PM dealers meet the threshold yet.
          </div>
        ) : (
          <Table
            cols={[
              { key: 'dealer', label: 'Dealer', width: '40%',
                render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
              { key: 'pm', label: 'Your only PM', width: '30%',
                render: v => formatPM(v) },
              { key: 'wonRev', label: 'Won revenue', width: '15%',
                render: v => fmtCurrency(v) },
              { key: 'wonCount', label: 'Jobs won', width: '15%' },
            ]}
            rows={d.singlePMDealers}
            defaultSort={{ key: 'wonRev', dir: 'desc' }}
          />
        )}
      </Card>

      {/* ── NEW SOURCES ───────────────────────────────────────────────── */}
      <SectionLabel>New sources — last 90 days</SectionLabel>
      <Card style={{ marginBottom: 16 }}>
        {newSourcesFiltered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: C.textMuted }}>
            No new PMs in the last 90 days.
          </div>
        ) : (
          <Table
            cols={[
              { key: 'pm', label: 'PM', width: '30%', render: v => formatPM(v) },
              { key: 'dealer', label: 'Dealer', width: '30%' },
              { key: 'firstDate', label: 'First quote', width: '20%' },
              { key: 'quoteCount', label: 'Quotes since', width: '20%' },
            ]}
            rows={newSourcesFiltered}
            onRowClick={r => {
              const pm = d.pmList.find(p => p.pm === r.pm);
              if (pm) setSelectedPM(pm);
            }}
            defaultSort={{ key: 'firstDate', dir: 'desc' }}
          />
        )}
      </Card>

      {/* ── PM DETAIL MODAL ───────────────────────────────────────────── */}
      {selectedPM && (
        <Modal
          title={`${formatPM(selectedPM.pm)} · ${selectedPM.dealer}`}
          onClose={() => setSelectedPM(null)}
          wide
        >
          {/* Header strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.textSub }}>
              {selectedPM.totalQuotes} lifetime quotes · {selectedPM.lifetimeCR !== null ? `${Math.round(selectedPM.lifetimeCR * 100)}% CR` : 'No CR yet'} · {fmtCurrency(selectedPM.revenueWon)} revenue
              {selectedPM.channels.length > 0 && (
                <> · <span style={{ color: C.textMuted }}>{selectedPM.channels.join(' + ')}</span></>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <StatusBadge status={selectedPM.status} />
              <PricingBadge pricing={selectedPM.suggestedPricing} />
            </div>
          </div>

          {/* Why suggested */}
          <div style={{
            background: '#f5f6f8', borderRadius: 6, padding: '10px 12px',
            marginBottom: 14, fontSize: 11, lineHeight: 1.5,
          }}>
            <span style={{ color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Why {selectedPM.suggestedPricing.toLowerCase()}:
            </span>
            <span style={{ color: C.textSub }}> {selectedPM.pricingReason}</span>
          </div>

          {/* Stat strip */}
          <Grid cols={4} gap={10} style={{ marginBottom: 14 }}>
            <DetailMini label="Last 30d" value={`${selectedPM.last30Count} quotes`} />
            <DetailMini label="Prior 30d" value={`${selectedPM.prior30Count} quotes`} />
            <DetailMini label="Avg quote $" value={fmtCurrency(selectedPM.avgValue)} />
            <DetailMini label="Open"
              value={selectedPM.openCount > 0 ? `${selectedPM.openCount} · ${fmtCurrency(selectedPM.openValue)}` : '—'} />
          </Grid>

          {/* Recently won + lost side by side */}
          <Grid cols={2} gap={12} style={{ marginBottom: 14 }}>
            <div>
              <div style={{
                fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
                letterSpacing: '.04em', fontWeight: 600, marginBottom: 6,
              }}>Recently won (last 5)</div>
              {selectedPM.recentlyWon.length === 0 ? (
                <div style={{ fontSize: 11, color: C.textMuted, padding: '6px 0' }}>None yet</div>
              ) : (
                selectedPM.recentlyWon.map((q, i) => (
                  <QuoteRow key={i} quote={q} onClick={() => setSelectedQuote(q)} />
                ))
              )}
            </div>
            <div>
              <div style={{
                fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
                letterSpacing: '.04em', fontWeight: 600, marginBottom: 6,
              }}>Recently lost (last 5)</div>
              {selectedPM.recentlyLost.length === 0 ? (
                <div style={{ fontSize: 11, color: C.textMuted, padding: '6px 0' }}>None recorded</div>
              ) : (
                selectedPM.recentlyLost.map((q, i) => (
                  <QuoteRow key={i} quote={q} onClick={() => setSelectedQuote(q)} />
                ))
              )}
            </div>
          </Grid>

          {/* Open quotes */}
          {selectedPM.recentOpen.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
                letterSpacing: '.04em', fontWeight: 600, marginBottom: 6,
              }}>Open quotes (top 5)</div>
              {selectedPM.recentOpen.map((q, i) => (
                <QuoteRow key={i} quote={q} onClick={() => setSelectedQuote(q)} showAge />
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── QUOTE DETAIL MODAL ────────────────────────────────────────── */}
      {selectedQuote && (
        <Modal
          title={`Order #${selectedQuote.orderNum}`}
          onClose={() => setSelectedQuote(null)}
        >
          {[
            ['Order name', selectedQuote.order_name || '—'],
            ['Dealer', selectedQuote.dealer],
            ['Channel', selectedQuote.channel],
            ['Date', fmtDate(selectedQuote.date)],
            ['Status', selectedQuote.status],
            ['Value', fmtCurrency(selectedQuote.value)],
            ['Outcome', selectedQuote.isWon ? 'Won' : selectedQuote.isLost ? 'Lost' : selectedQuote.isOpen ? 'Open' : '—'],
          ].map(([k, v]) => <DetailRow key={k} label={k} value={v} />)}
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers and sub-components
// ─────────────────────────────────────────────────────────────

function whatChangedText(r) {
  if (r.status === 'cold') {
    if (r.lifetimeMonthly >= 3) {
      return `Was sending ~${Math.round(r.lifetimeMonthly)}/mo · now silent`;
    }
    return 'No quote in 14+ days';
  }
  if (r.status === 'cooling') {
    return `Avg ${Math.round(r.lifetimeMonthly)}/mo over ${r.tenureMonths}mo · last 30d: ${r.last30Count}`;
  }
  if (r.status === 'hot') {
    return `Up from ~${Math.round(r.lifetimeMonthly)}/mo to ${r.last30Count} in last 30d`;
  }
  return '';
}

function ActionStatCard({ label, count, sub, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: `${active ? '2px' : '0.5px'} solid ${active ? color : C.border}`,
        borderRadius: 10,
        padding: active ? '10px 13px' : '11px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{
          fontSize: 11, fontWeight: 700, color,
          textTransform: 'uppercase', letterSpacing: '.04em',
        }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{count}</div>
      <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function DetailMini({ label, value }) {
  return (
    <div style={{ background: '#f5f6f8', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function QuoteRow({ quote, onClick, showAge }) {
  const dateText = fmtDate(quote.date);
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 0', borderBottom: `0.5px solid ${C.border}`,
        cursor: 'pointer', fontSize: 11,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8,
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ color: C.textMuted }}>#{quote.orderNum}</span>{' '}
        {quote.order_name || quote.dealer}
      </span>
      <span style={{ color: C.text, fontWeight: 600 }}>{fmtCurrency(quote.value)}</span>
      <span style={{ color: C.textMuted, fontSize: 10, minWidth: 50, textAlign: 'right' }}>
        {showAge && quote.date ? `${Math.floor((new Date() - quote.date) / 86400000)}d` : dateText}
      </span>
    </div>
  );
}