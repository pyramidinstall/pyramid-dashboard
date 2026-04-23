import React, { useState } from 'react';
import { C, Modal, Table, Badge, DetailRow } from '../components/UI';
import { usePipelineData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct } from '../utils/sheets';

// ─────────────────────────────────────────────────────────────────────────
// Google Form URL for PM Review Log — Jordan will replace these values
// after creating the form. See PUNCH_LIST.md for setup instructions.
//
// To get these values:
//   1. Create Google Form with field: PM name (dropdown or short answer)
//   2. Click Send → Copy link, this is PM_REVIEW_FORM_BASE
//   3. Click "..." → Get pre-filled link → fill PM name → "Get link"
//      The URL contains entry.XXXXXXXX=TEST — copy the number
//   4. Paste both below
// ─────────────────────────────────────────────────────────────────────────
const PM_REVIEW_FORM_BASE = ''; // e.g. 'https://docs.google.com/forms/d/e/FORM_ID/viewform'
const PM_REVIEW_FORM_PM_FIELD = ''; // e.g. 'entry.123456789'

function pmReviewFormUrl(pmName) {
  if (!PM_REVIEW_FORM_BASE) return null;
  if (!PM_REVIEW_FORM_PM_FIELD) return PM_REVIEW_FORM_BASE;
  return `${PM_REVIEW_FORM_BASE}?${PM_REVIEW_FORM_PM_FIELD}=${encodeURIComponent(pmName)}`;
}

export default function Pipeline({ data }) {
  const d = usePipelineData(data);
  const [reviewPM, setReviewPM] = useState(null); // PM object from reviewQueue
  const [winRateDrill, setWinRateDrill] = useState(null); // 'pm' | 'dealer' | 'cohort'
  const [orderDetail, setOrderDetail] = useState(null);
  const [drill, setDrill] = useState(null); // generic list drill-down

  if (!d) return null;

  // Clean PM display name helper ("LAST, First" → "First Last")
  const formatPM = (pm) => {
    if (!pm) return '';
    if (pm.includes(',')) {
      const [last, first] = pm.split(',').map(s => s.trim());
      return `${first} ${last}`.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    return pm.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      {/* TITLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Pipeline</h1>
          <p style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>Filling the funnel · closing the open book</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: C.textSub }}>{d.monthName} {d.year}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>day {d.dayOfMonth} of {d.daysInMonth}</div>
        </div>
      </div>

      {/* WINS TICKER */}
      {d.winsThisWeekCount > 0 && (
        <div style={{
          background: '#EAF3DE', border: '0.5px solid #C0DD97', borderRadius: 12,
          padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#27500A', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>
            Won this week
          </div>
          <div style={{ fontSize: 13, color: '#173404' }}>
            <span style={{ fontWeight: 600 }}>{d.winsThisWeekCount} {d.winsThisWeekCount === 1 ? 'job' : 'jobs'} · {fmtCurrency(d.winsThisWeekValue)}</span>
            {d.winsThisWeek.slice(0, 3).map((w, i) => (
              <React.Fragment key={w.order_number}>
                <span style={{ color: '#3B6D11', margin: '0 8px' }}>·</span>
                {(w.order_name || w.customer).slice(0, 30)} {fmtCurrency(w.gt)}
              </React.Fragment>
            ))}
            {d.winsThisWeek.length > 3 && (
              <span style={{ color: '#3B6D11', marginLeft: 8 }}>+ {d.winsThisWeek.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {/* BLOCK 1: AT A GLANCE (4 cards) */}
      <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          This month at a glance
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <StatCard
            label="Wins this month"
            value={`${d.winsThisMonthCount}`}
            valueSub={`· ${fmtCurrency(d.winsThisMonthValue)}`}
            valueColor={C.green}
            footer={`vs ${d.winsLastMonthCount} · ${fmtCurrency(d.winsLastMonthValue)} last month`}
            onClick={d.winsThisMonthCount > 0 ? () => setDrill({
              title: `Wins this month (${d.winsThisMonthCount})`,
              type: 'wins',
              items: d.winsThisMonth,
            }) : null}
          />

          <WinRateCard
            rate={d.winRateL90Count}
            y1Rate={d.winRateY1Count}
            decided={d.winRateDecidedL90}
            won={d.winRateWonL90}
            onClick={() => setWinRateDrill('pm')}
          />

          <ProgressCard
            label="New PMs this month"
            current={d.newPMsThisMonthCount}
            target={2}
            footer={`${d.newPMsY2YTD} added Year 2 YTD`}
            onClick={d.newPMsThisMonthCount > 0 ? () => setDrill({
              title: `New PMs this month (${d.newPMsThisMonthCount})`,
              type: 'newPMs',
              items: d.newPMsThisMonth,
            }) : null}
          />

          <ProgressCard
            label={`New dealers · Q${Math.floor(new Date().getMonth() / 3) + 1} ${d.year}`}
            current={d.newDealersThisQCount}
            target={2}
            footer={`${d.newDealersY2YTD} added Year 2 YTD`}
            color="#639922"
            onClick={d.newDealersThisQCount > 0 ? () => setDrill({
              title: `New dealers this quarter (${d.newDealersThisQCount})`,
              type: 'newDealers',
              items: d.newDealersThisQ,
            }) : null}
          />
        </div>
      </div>

      {/* BLOCK 2: PACE BARS */}
      <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>
          Quote pace · through day {d.dayOfMonth} of {d.daysInMonth}
        </div>

        <PaceBar
          label="Quotes sent"
          current={d.quotesThisMonthCount}
          projection={d.projectedMonthEndCount}
          target={d.trailingMo3Count}
          best={d.allTimeBestCount}
          monthProgress={d.monthProgress}
          isValue={false}
        />

        <div style={{ height: 24 }} />

        <PaceBar
          label="Quote value"
          current={d.quotesThisMonthValue}
          projection={d.projectedMonthEndValue}
          target={d.trailingMo3Value}
          best={d.allTimeBestValue}
          monthProgress={d.monthProgress}
          isValue={true}
        />
      </div>

      {/* BLOCK 3: MOONSHOTS (all shown, no truncation) */}
      {d.moonshotsCount > 0 && (
        <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Moonshots · open $50K+
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {d.moonshotsCount} open · {fmtCurrency(d.moonshotsFace)} face · Year 1 win rate 7%
            </div>
          </div>
          <div style={{ borderTop: `0.5px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1.5fr 1.2fr 70px 80px', gap: 8, padding: '7px 0', borderBottom: `0.5px solid ${C.border}`, fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>
              <span>#</span><span>Order name</span><span>Dealer / PM</span><span>Age</span><span style={{ textAlign: 'right' }}>Face</span>
            </div>
            {d.moonshots.map((m, i) => (
              <div key={m.order_number}
                onClick={() => setOrderDetail(m)}
                style={{
                  display: 'grid', gridTemplateColumns: '70px 1.5fr 1.2fr 70px 80px', gap: 8,
                  padding: '8px 0',
                  borderBottom: i < d.moonshots.length - 1 ? `0.5px solid ${C.border}` : 'none',
                  fontSize: 12, alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f8fc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ color: C.textMuted }}>#{m.order_number}</span>
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.order_name || '—'}</span>
                <span style={{ color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.customer} / {formatPM(m.pm)}
                </span>
                <span style={{ color: C.textSub }}>{m.age}d</span>
                <span style={{ color: C.text, fontWeight: 600, textAlign: 'right' }}>{fmtCurrency(m.gt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOCK 4: PM REVIEW QUEUE */}
      {d.reviewQueueCount > 0 && (
        <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              PM review queue
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {d.reviewQueueCount} {d.reviewQueueCount === 1 ? 'PM' : 'PMs'} due · {fmtCurrency(d.reviewQueueValue)} open · click row for full review
            </div>
          </div>

          <div style={{ borderTop: `0.5px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.2fr 80px 60px', gap: 8, padding: '7px 0', borderBottom: `0.5px solid ${C.border}`, fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>
              <span>PM</span><span>Dealer</span><span>Why reviewing</span>
              <span style={{ textAlign: 'right' }}>Open $</span>
              <span style={{ textAlign: 'right' }}>#</span>
            </div>

            {d.reviewQueue.map((entry, i) => (
              <div key={entry.pm}
                onClick={() => setReviewPM(entry)}
                style={{
                  display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.2fr 80px 60px', gap: 8,
                  padding: '10px 0',
                  borderBottom: i < d.reviewQueue.length - 1 ? `0.5px solid ${C.border}` : 'none',
                  fontSize: 12, alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s',
                  background: entry.severity === 'red' ? 'rgba(231, 76, 74, 0.04)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f8fc'}
                onMouseLeave={e => e.currentTarget.style.background = entry.severity === 'red' ? 'rgba(231, 76, 74, 0.04)' : 'transparent'}>
                <span style={{ color: C.text, fontWeight: 600 }}>{formatPM(entry.pm)}</span>
                <span style={{ color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.dealer}</span>
                <span style={{ color: entry.severity === 'red' ? C.red : C.amber, fontSize: 11 }}>{entry.whyReviewing}</span>
                <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{fmtCurrency(entry.openValue)}</span>
                <span style={{ textAlign: 'right', color: C.textSub }}>{entry.openCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOCK 5: RECENTLY EXPIRED */}
      {d.recentlyExpired.length > 0 && (
        <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Recently expired · rescue candidates
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>last 45 days · L+ only</div>
          </div>
          <Table
            cols={[
              { key: 'order_number', label: '#', width: '10%', render: v => <span style={{ color: C.textMuted }}>#{v}</span> },
              { key: 'order_name', label: 'Order name', width: '26%', render: v => v || '—' },
              { key: 'customer', label: 'Dealer', width: '18%' },
              { key: 'pm', label: 'PM', width: '16%', render: v => formatPM(v) },
              { key: 'daysToExpiry', label: 'Expired', width: '14%', render: v => <Badge type="amber">{Math.abs(v)}d ago</Badge> },
              { key: 'gt', label: 'Face', width: '12%', render: v => fmtCurrency(v) },
            ]}
            rows={d.recentlyExpired}
            onRowClick={setOrderDetail}
            defaultSort={{ key: 'daysToExpiry', dir: 'desc' }}
          />
        </div>
      )}

      {/* BLOCK 6: LARGE OPEN JOBS */}
      <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Large open jobs · $15K–$50K
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            {d.largeOpenJobsCount} quotes · {fmtCurrency(d.largeOpenJobsFace)} face · sortable · filterable
          </div>
        </div>
        <Table
          cols={[
            { key: 'order_number', label: '#', width: '8%', render: v => <span style={{ color: C.textMuted }}>#{v}</span> },
            { key: 'order_name', label: 'Order name', width: '22%', render: v => v || '—' },
            { key: 'customer', label: 'Dealer', width: '17%' },
            { key: 'pm', label: 'PM', width: '14%', render: v => formatPM(v) },
            { key: 'gt', label: 'Face', width: '10%', render: v => fmtCurrency(v) },
            { key: 'pipelineWeighted', label: 'Wtd', width: '10%', render: v => fmtCurrency(v || 0) },
            { key: 'age', label: 'Age', width: '9%', render: v => `${v}d` },
            { key: 'daysToExpiry', label: 'Exp', width: '10%', render: v => {
              if (v === null || v === undefined) return '—';
              if (v < 0) return <Badge type="gray">exp</Badge>;
              if (v <= 14) return <Badge type="red">{v}d</Badge>;
              if (v <= 30) return <Badge type="amber">{v}d</Badge>;
              return `${v}d`;
            } },
          ]}
          rows={d.largeOpenJobs}
          onRowClick={setOrderDetail}
          defaultSort={{ key: 'gt', dir: 'desc' }}
        />
      </div>

      {/* ─────────── MODALS ─────────── */}

      {reviewPM && (
        <PMReviewModal
          entry={reviewPM}
          data={data}
          formatPM={formatPM}
          pmMedian={reviewPM.pmMedian}
          onClose={() => setReviewPM(null)}
        />
      )}

      {winRateDrill && (
        <Modal wide title="Win rate · L90d breakdown" onClose={() => setWinRateDrill(null)}>
          <WinRateDrill data={d} initialView={winRateDrill} formatPM={formatPM} />
        </Modal>
      )}

      {drill && (
        <Modal wide title={drill.title} onClose={() => setDrill(null)}>
          <DrillTable drill={drill} onOrderClick={setOrderDetail} formatPM={formatPM} />
        </Modal>
      )}

      {orderDetail && (
        <Modal title={`Order #${orderDetail.order_number}`} onClose={() => setOrderDetail(null)}>
          <DetailRow label="Order name" value={orderDetail.order_name || '—'} />
          <DetailRow label="Dealer" value={orderDetail.customer} />
          <DetailRow label="PM" value={formatPM(orderDetail.pm)} />
          <DetailRow label="Status" value={orderDetail.status} />
          <DetailRow label="Face value" value={fmtCurrency(orderDetail.gt)} />
          <DetailRow label="Cohort" value={orderDetail.cohort} />
          {orderDetail.pipelineCR !== null && orderDetail.pipelineCR !== undefined && (
            <>
              <DetailRow label="Win rate" value={`${Math.round(orderDetail.pipelineCR * 100)}%`} />
              <DetailRow label="Weighted value" value={fmtCurrency(orderDetail.pipelineWeighted || 0)} />
            </>
          )}
          {orderDetail.lqp_start_date && <DetailRow label="Presented" value={orderDetail.lqp_start_date} />}
          {orderDetail.daysPresented !== null && orderDetail.daysPresented !== undefined && <DetailRow label="Days presented" value={`${orderDetail.daysPresented} days`} />}
          {orderDetail.expiry_date && <DetailRow label="Expires" value={orderDetail.expiry_date} />}
          {orderDetail.daysToExpiry !== null && orderDetail.daysToExpiry !== undefined && <DetailRow label="Days to expiry" value={`${orderDetail.daysToExpiry} days`} />}
          {orderDetail.modification_notes && (
            <div style={{ marginTop: 12, fontSize: 12, color: C.textSub }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Notes:</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{orderDetail.modification_notes}</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─────────────────── LOCAL COMPONENTS ───────────────────

function StatCard({ label, value, valueSub, valueColor, footer, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#f0f2f5', borderRadius: 8, padding: '10px 12px',
        cursor: onClick ? 'pointer' : 'default', transition: 'background 0.1s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = '#e6edf5')}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = '#f0f2f5')}>
      <div style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: valueColor || C.text, marginTop: 2 }}>
        {value}{valueSub && <span style={{ fontSize: 13, color: C.textSub, fontWeight: 400 }}> {valueSub}</span>}
      </div>
      {footer && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{footer}</div>}
    </div>
  );
}

function WinRateCard({ rate, y1Rate, decided, won, onClick }) {
  if (rate === null) {
    return (
      <div style={{ background: '#f0f2f5', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>Win rate · L90d</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.textMuted, marginTop: 2 }}>—</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>not enough data</div>
      </div>
    );
  }

  const pct = Math.round(rate * 100);
  const y1Pct = y1Rate !== null ? Math.round(y1Rate * 100) : null;
  const delta = y1Pct !== null ? pct - y1Pct : null;

  let valueColor = C.text;
  let footerColor = C.textMuted;
  let footerText;
  if (delta === null) {
    footerText = `${decided} decided · ${won} won`;
  } else if (delta >= 0) {
    footerText = `vs ${y1Pct}% Year 1 · on track`;
    footerColor = C.green;
  } else if (delta >= -5) {
    footerText = `vs ${y1Pct}% Year 1 · on track`;
  } else if (delta >= -10) {
    footerText = `vs ${y1Pct}% Year 1 · watch`;
    valueColor = C.amber;
    footerColor = C.amber;
  } else {
    footerText = `vs ${y1Pct}% Year 1 · pricing check?`;
    valueColor = C.red;
    footerColor = C.red;
  }

  return (
    <div
      onClick={onClick}
      style={{ background: '#f0f2f5', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#e6edf5'}
      onMouseLeave={e => e.currentTarget.style.background = '#f0f2f5'}>
      <div style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>Win rate · L90d</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: valueColor, marginTop: 2 }}>{pct}%</div>
      <div style={{ fontSize: 11, color: footerColor, marginTop: 4 }}>{footerText}</div>
    </div>
  );
}

function ProgressCard({ label, current, target, footer, color, onClick }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const barColor = color || (pct >= 100 ? '#639922' : pct >= 50 ? '#EF9F27' : '#E24B4A');
  const valueColor = current === 0 ? C.red : current >= target ? C.green : C.text;

  return (
    <div
      onClick={onClick}
      style={{ background: '#f0f2f5', borderRadius: 8, padding: '10px 12px', cursor: onClick ? 'pointer' : 'default', transition: 'background 0.1s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = '#e6edf5')}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = '#f0f2f5')}>
      <div style={{ fontSize: 11, color: C.textSub, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2, marginBottom: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: valueColor }}>{current}</span>
        <span style={{ fontSize: 12, color: C.textSub }}>of {target}</span>
      </div>
      <div style={{ height: 5, background: '#F1EFE8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor }} />
      </div>
      {footer && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{footer}</div>}
    </div>
  );
}

// Pace bar — matches v5 mockup
// Filled bar = current through today. Tick marks = 3-mo avg and all-time best
// (positioned at their share of all-time-best, clamped to bar width).
function PaceBar({ label, current, projection, target, best, monthProgress, isValue }) {
  const fmt = isValue ? fmtCurrency : (v) => String(v);

  // Bar scale: max of (projection, target, best) padded by 8% so best tick
  // doesn't sit exactly at the right edge (its label needs room).
  const rawMax = Math.max(projection, target, best, 1);
  const scaleMax = rawMax * 1.08;
  const currentPct = Math.min(100, (current / scaleMax) * 100);
  const targetPct = Math.min(100, (target / scaleMax) * 100);
  const bestPct = Math.min(100, (best / scaleMax) * 100);

  // "On pace" judgement based on projection vs target
  // On day 1 we haven't had time, so be gentle
  let status, statusColor;
  if (monthProgress < 0.15) {
    // Too early in month to make strong statements
    status = 'Early month';
    statusColor = C.textMuted;
  } else if (projection >= target * 1.05) {
    status = 'Ahead of pace';
    statusColor = C.green;
  } else if (projection >= target * 0.95) {
    status = 'On pace';
    statusColor = C.green;
  } else if (projection >= target * 0.85) {
    status = 'Slightly behind';
    statusColor = C.amber;
  } else {
    status = 'Behind pace';
    statusColor = C.red;
  }

  // Smart action text
  const actionText = (() => {
    if (monthProgress < 0.15) {
      return `Early in the month — projection will stabilize over the next week.`;
    }
    if (projection >= best) {
      return `On pace for a new all-time best. Keep pushing.`;
    }
    if (projection >= target * 0.95) {
      const gap = Math.round(best - projection);
      if (gap > 0 && isValue) {
        return `Projecting ${fmt(projection)} — matches 3-mo average. ${fmt(Math.abs(gap))} more to beat all-time best.`;
      } else if (gap > 0) {
        return `Projecting ${projection} — matches 3-mo average. ${Math.abs(gap)} more to beat all-time best.`;
      }
      return `Projecting ${fmt(projection)} — matches 3-mo average.`;
    }
    if (projection >= target * 0.85) {
      const gap = Math.round(target - projection);
      return isValue
        ? `${fmt(Math.abs(gap))} below 3-mo avg projection at current pace. Biggest open jobs could close the gap.`
        : `${Math.abs(gap)} quotes below 3-mo avg projection at current pace.`;
    }
    return `Significantly behind 3-mo average at current pace.`;
  })();

  return (
    <div>
      {/* Header row — current + projection left, reference values right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: C.text }}>{fmt(current)}</span>
            <span style={{ fontSize: 12, color: C.textSub }}>on pace for {fmt(projection)} by month-end</span>
          </div>
        </div>
      </div>

      {/* The bar with ticks */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', height: 12, background: '#F1EFE8', borderRadius: 6, overflow: 'visible' }}>
          <div style={{ width: `${currentPct}%`, height: '100%', background: status === 'Behind pace' ? '#E24B4A' : status === 'Slightly behind' ? '#EF9F27' : '#97C459', borderRadius: 6, transition: 'width .3s' }} />
          {/* 3-mo avg tick */}
          <div style={{ position: 'absolute', left: `${targetPct}%`, top: -3, bottom: -3, width: 2, background: '#888780', transform: 'translateX(-1px)' }} />
          {/* All-time best tick */}
          <div style={{ position: 'absolute', left: `${bestPct}%`, top: -3, bottom: -3, width: 2, background: '#2C2C2A', transform: 'translateX(-1px)' }} />
        </div>
        {/* Tick labels BELOW — with their numbers */}
        <div style={{ position: 'absolute', left: `${targetPct}%`, top: 16, fontSize: 10, color: C.textMuted, transform: 'translateX(-50%)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
          <div style={{ fontWeight: 500, color: C.textSub }}>{fmt(target)}</div>
          <div>3-mo avg</div>
        </div>
        <div style={{ position: 'absolute', left: `${bestPct}%`, top: 16, fontSize: 10, color: C.textMuted, transform: 'translateX(-50%)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
          <div style={{ fontWeight: 500, color: C.textSub }}>{fmt(best)}</div>
          <div>all-time best</div>
        </div>
      </div>

      {/* Status line — offset enough to clear tick labels */}
      <div style={{ fontSize: 11, color: C.text, marginTop: 40, lineHeight: 1.5 }}>
        <span style={{ color: statusColor, fontWeight: 600 }}>{status}.</span> {actionText}
      </div>
    </div>
  );
}

// PM review modal — the "Billy on a call" view
function PMReviewModal({ entry, data, formatPM, pmMedian, onClose }) {
  const { orders } = data;
  const pm = entry.pm;

  const formUrl = pmReviewFormUrl(pm);

  // All quotes by this PM (non-INET)
  const pmOrders = orders.filter(r => r.pm === pm && !r.isInet);

  // Open quotes with contextual flags
  const openQuotes = pmOrders.filter(r => r.isOpen).map(r => {
    let flag = '';
    let flagColor = C.textMuted;
    if (r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 14) {
      flag = `expiring in ${r.daysToExpiry}d`;
      flagColor = C.red;
    } else if ((r.daysPresented || 0) >= Math.max(pmMedian - 14, 7)) {
      flag = 'in decision window';
      flagColor = C.amber;
    } else if ((r.daysPresented || 0) < 7) {
      flag = `fresh · ${r.daysPresented || 0}d old`;
      flagColor = C.textMuted;
    } else {
      flag = `${r.daysPresented || 0}d old`;
      flagColor = C.textSub;
    }
    return { ...r, flag, flagColor };
  }).sort((a, b) => b.gt - a.gt);

  // Recently expired (this PM, last 45d, L+)
  const pmExpired = pmOrders.filter(r =>
    r.status === 'Labor Quote Expired' && r.gt >= 15000 &&
    r.daysToExpiry !== null && r.daysToExpiry < 0 && r.daysToExpiry > -45
  ).sort((a, b) => (b.daysToExpiry || 0) - (a.daysToExpiry || 0));

  // Recently won (this PM, last 30d)
  const today = new Date();
  const monthAgo = new Date(today - 30 * 86400000);
  const pmWon = pmOrders.filter(r => r.isWon).map(r => {
    const wonDate = r.approved_start_date ? new Date(r.approved_start_date)
                  : r.inprog_start_date ? new Date(r.inprog_start_date) : null;
    return { ...r, wonDate };
  }).filter(r => r.wonDate && r.wonDate >= monthAgo)
    .sort((a, b) => b.wonDate - a.wonDate)
    .slice(0, 5);

  // Decided count for win rate
  const decided = pmOrders.filter(r => r.isDecided);
  const won = decided.filter(r => r.isWon);
  const winRate = decided.length >= 5 ? won.length / decided.length : null;

  // Last quote date
  const lastQuoteDate = pmOrders.length > 0
    ? pmOrders.reduce((latest, r) => {
        const d = r.created_date ? new Date(r.created_date) : null;
        if (!d) return latest;
        return !latest || d > latest ? d : latest;
      }, null)
    : null;
  const lastQuoteDaysAgo = lastQuoteDate
    ? Math.floor((today - lastQuoteDate) / 86400000) : null;

  return (
    <Modal wide title={`${formatPM(pm)} · ${entry.dealer}`} onClose={onClose}>
      {/* Meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, fontSize: 12, color: C.textSub }}>
        <div>
          {decided.length} decided quotes{winRate !== null && ` · ${Math.round(winRate * 100)}% win rate`} · typical decision window {pmMedian}d
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          <div style={{ color: C.textMuted }}>Last reviewed</div>
          <div style={{ color: C.text, fontWeight: 600 }}>
            {entry.lastReviewDate
              ? `${entry.lastReviewDate} · ${entry.daysSinceReview}d ago`
              : 'never'}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
        <div style={{ background: '#f0f2f5', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Open</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2 }}>
            {entry.openCount} · {fmtCurrency(entry.openValue)}
          </div>
        </div>
        <div style={{ background: '#f0f2f5', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Decided</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.green, marginTop: 2 }}>
            {won.length} won / {decided.length}
          </div>
        </div>
        <div style={{ background: '#f0f2f5', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Recently expired</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2 }}>
            {pmExpired.length} · {fmtCurrency(pmExpired.reduce((s, r) => s + r.gt, 0))}
          </div>
        </div>
        <div style={{ background: '#f0f2f5', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Last quote</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2 }}>
            {lastQuoteDaysAgo !== null ? `${lastQuoteDaysAgo}d ago` : '—'}
          </div>
        </div>
      </div>

      {/* Open quotes */}
      {openQuotes.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Open quotes · priority order
          </div>
          <div style={{ borderTop: `0.5px solid ${C.border}` }}>
            {openQuotes.map((q, i) => (
              <div key={q.order_number} style={{
                display: 'grid', gridTemplateColumns: '60px 1.4fr 1fr 70px 60px', gap: 8,
                padding: '7px 0',
                borderBottom: i < openQuotes.length - 1 ? `0.5px solid ${C.border}` : 'none',
                fontSize: 12, alignItems: 'center',
              }}>
                <span style={{ color: C.textMuted }}>#{q.order_number}</span>
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.order_name || '—'}</span>
                <span style={{ color: q.flagColor, fontSize: 11 }}>{q.flag}</span>
                <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{fmtCurrency(q.gt)}</span>
                <span style={{ textAlign: 'right', color: C.textSub }}>
                  {q.daysToExpiry !== null && q.daysToExpiry !== undefined ? `${q.daysToExpiry}d` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently expired for this PM */}
      {pmExpired.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Recently expired · rescue candidates
          </div>
          <div style={{ borderTop: `0.5px solid ${C.border}` }}>
            {pmExpired.map((q, i) => (
              <div key={q.order_number} style={{
                display: 'grid', gridTemplateColumns: '60px 1.4fr 1fr 70px', gap: 8,
                padding: '7px 0',
                borderBottom: i < pmExpired.length - 1 ? `0.5px solid ${C.border}` : 'none',
                fontSize: 12, alignItems: 'center',
              }}>
                <span style={{ color: C.textMuted }}>#{q.order_number}</span>
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.order_name || '—'}</span>
                <span style={{ color: C.textSub, fontSize: 11 }}>expired {Math.abs(q.daysToExpiry)}d ago</span>
                <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{fmtCurrency(q.gt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently won */}
      {pmWon.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Recently won · thank them
          </div>
          <div style={{ borderTop: `0.5px solid ${C.border}` }}>
            {pmWon.map((q, i) => (
              <div key={q.order_number} style={{
                display: 'grid', gridTemplateColumns: '60px 1.4fr 1fr 70px', gap: 8,
                padding: '7px 0',
                borderBottom: i < pmWon.length - 1 ? `0.5px solid ${C.border}` : 'none',
                fontSize: 12, alignItems: 'center',
              }}>
                <span style={{ color: C.textMuted }}>#{q.order_number}</span>
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.order_name || '—'}</span>
                <span style={{ color: C.green, fontSize: 11 }}>won · {q.status}</span>
                <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{fmtCurrency(q.gt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Previous review notes */}
      {entry.lastReviewNotes && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Previous review · {entry.lastReviewDate}
          </div>
          <div style={{ background: '#f0f2f5', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: C.text, fontStyle: 'italic' }}>
            "{entry.lastReviewNotes}"
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: `0.5px solid ${C.border}` }}>
        <button
          onClick={onClose}
          style={{ fontSize: 12, padding: '7px 14px', background: 'transparent', border: `0.5px solid ${C.border}`, borderRadius: 6, color: C.textSub, cursor: 'pointer' }}>
          Close
        </button>
        {formUrl ? (
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, padding: '7px 14px', background: '#185FA5', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
            Log review ↗
          </a>
        ) : (
          <button
            title="Set PM_REVIEW_FORM_BASE in Pipeline.js after creating Google Form"
            disabled
            style={{ fontSize: 12, padding: '7px 14px', background: '#B4B2A9', border: 'none', borderRadius: 6, color: '#fff', cursor: 'not-allowed', fontWeight: 600 }}>
            Log review ↗ (form not configured)
          </button>
        )}
      </div>
    </Modal>
  );
}

// Win rate drill-down — tabbed view by PM / dealer / cohort
function WinRateDrill({ data, initialView, formatPM }) {
  const [view, setView] = useState(initialView);

  const tabStyle = (active) => ({
    padding: '6px 14px', fontSize: 12, fontWeight: 600,
    background: active ? '#185FA5' : 'transparent',
    color: active ? '#fff' : C.textSub,
    border: `0.5px solid ${active ? '#185FA5' : C.border}`,
    borderRadius: 4, cursor: 'pointer', marginRight: 6,
  });

  return (
    <div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
        Last 90 days · {data.winRateDecidedL90} decided quotes · {data.winRateWonL90} won ({Math.round(data.winRateL90Count * 100)}% count / {Math.round(data.winRateL90Dollar * 100)}% dollar)
      </div>
      <div style={{ display: 'flex', marginBottom: 14 }}>
        <button style={tabStyle(view === 'pm')} onClick={() => setView('pm')}>By PM</button>
        <button style={tabStyle(view === 'dealer')} onClick={() => setView('dealer')}>By Dealer</button>
        <button style={tabStyle(view === 'cohort')} onClick={() => setView('cohort')}>By Cohort</button>
      </div>

      {view === 'pm' && (
        <Table
          cols={[
            { key: 'pm', label: 'PM', width: '35%', render: v => formatPM(v) },
            { key: 'decided', label: 'Decided', width: '15%' },
            { key: 'won', label: 'Won', width: '15%' },
            { key: 'rate', label: 'L90d', width: '15%', render: v => <Badge type={v >= 0.5 ? 'green' : v >= 0.3 ? 'amber' : 'red'}>{Math.round(v * 100)}%</Badge> },
            { key: 'y1Rate', label: 'Year 1', width: '20%', render: v => v !== null ? `${Math.round(v * 100)}%` : '—' },
          ]}
          rows={data.winRateByPM}
          defaultSort={{ key: 'decided', dir: 'desc' }}
        />
      )}

      {view === 'dealer' && (
        <Table
          cols={[
            { key: 'customer', label: 'Dealer', width: '40%' },
            { key: 'decided', label: 'Decided', width: '15%' },
            { key: 'won', label: 'Won', width: '12%' },
            { key: 'rate', label: 'L90d', width: '15%', render: v => <Badge type={v >= 0.5 ? 'green' : v >= 0.3 ? 'amber' : 'red'}>{Math.round(v * 100)}%</Badge> },
            { key: 'y1Rate', label: 'Year 1', width: '18%', render: v => v !== null ? `${Math.round(v * 100)}%` : '—' },
          ]}
          rows={data.winRateByDealer}
          defaultSort={{ key: 'decided', dir: 'desc' }}
        />
      )}

      {view === 'cohort' && (
        <Table
          cols={[
            { key: 'cohort', label: 'Cohort', width: '28%' },
            { key: 'decided', label: 'Decided', width: '17%' },
            { key: 'won', label: 'Won', width: '13%' },
            { key: 'rate', label: 'L90d', width: '18%', render: v => v !== null ? <Badge type={v >= 0.5 ? 'green' : v >= 0.3 ? 'amber' : 'red'}>{Math.round(v * 100)}%</Badge> : '—' },
            { key: 'y1Rate', label: 'Year 1', width: '24%', render: v => v !== null ? `${Math.round(v * 100)}%` : '—' },
          ]}
          rows={data.winRateByCohort}
        />
      )}
    </div>
  );
}

// Generic drill-down table for drills triggered from cards
function DrillTable({ drill, onOrderClick, formatPM }) {
  const { type, items } = drill;

  const defaultSort = (() => {
    switch (type) {
      case 'wins': return { key: 'gt', dir: 'desc' };
      case 'newPMs': return { key: 'quoteCount', dir: 'desc' };
      case 'newDealers': return { key: 'quoteCount', dir: 'desc' };
      default: return null;
    }
  })();

  const cols = (() => {
    switch (type) {
      case 'wins':
        return [
          { key: 'order_number', label: '#', width: '10%', render: v => <span style={{ color: C.textMuted }}>#{v}</span> },
          { key: 'order_name', label: 'Order name', width: '28%', render: v => v || '—' },
          { key: 'customer', label: 'Dealer', width: '20%' },
          { key: 'pm', label: 'PM', width: '18%', render: v => formatPM(v) },
          { key: 'status', label: 'Status', width: '14%' },
          { key: 'gt', label: 'Value', width: '10%', render: v => fmtCurrency(v) },
        ];
      case 'newPMs':
        return [
          { key: 'pm', label: 'PM', width: '30%', render: v => formatPM(v) },
          { key: 'dealer', label: 'Dealer', width: '28%' },
          { key: 'firstDate', label: 'First quote', width: '20%' },
          { key: 'quoteCount', label: 'Quotes', width: '14%' },
        ];
      case 'newDealers':
        return [
          { key: 'customer', label: 'Dealer', width: '50%' },
          { key: 'firstDate', label: 'First quote', width: '25%' },
          { key: 'quoteCount', label: 'Quotes', width: '20%' },
        ];
      default:
        return [{ key: 'summary', label: 'Item' }];
    }
  })();

  const clickHandler = type === 'wins' && onOrderClick ? onOrderClick : null;

  return (
    <>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
        {items.length} item{items.length === 1 ? '' : 's'} · click column header to sort
      </div>
      <Table cols={cols} rows={items} onRowClick={clickHandler} defaultSort={defaultSort} />
    </>
  );
}
