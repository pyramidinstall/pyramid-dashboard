import React, { useState } from 'react';
import { C, InfoTooltip, Modal, Table, Badge, DetailRow } from '../components/UI';
import { useOverviewData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct } from '../utils/sheets';

export default function Overview({ data }) {
  const d = useOverviewData(data);
  const [drill, setDrill] = useState(null); // { title, type, items } or null
  const [orderDetail, setOrderDetail] = useState(null); // for XL bounty detail

  if (!d) return null;

  const coverageText = d.coverageMonths.toFixed(1);
  const onPace = d.pctOfTarget >= 1.0;
  const paceText = onPace ? `On pace.` : `Below target.`;
  const paceDetail = onPace
    ? `Committed work (${fmtCurrency(d.committed)}) covers ${coverageText} months of target. We have work to do to keep it there — see momentum below.`
    : `Base forecast is ${fmtPct(d.pctOfTarget)} of $3M target. Committed work covers ${coverageText} months. Gap must come from future quotes.`;

  // Composition percentages
  const totalComp = d.yr2Rev + d.arWeighted + d.flightWeighted + d.pipelineWeighted + d.futureBase;
  const pct = (v) => totalComp > 0 ? (v / totalComp) * 100 : 0;

  // Original order lookup for XL bounty click
  const openXLOrders = data.orders.filter(r => r.isOpen && !r.isInet && r.gt >= 50000);

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.text }}>Pyramid Office Solutions — owner dashboard</h1>
          <p style={{ fontSize:12, color:C.textSub, marginTop:2 }}>Jordan Bass · Year 2: Apr 1, 2026 – Mar 31, 2027 · $3M target</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:24, fontWeight:700, color:C.amber }}>Day {d.dayOfYear2}</div>
          <div style={{ fontSize:11, color:C.textMuted }}>of 365</div>
        </div>
      </div>

      {/* BLOCK 1: Year 2 forecast */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Year 2 forecast</div>

        <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:10 }}>
          <div style={{ fontSize:30, fontWeight:600, color:C.text }}>{fmtCurrency(d.forecastBase)}</div>
          <div style={{ fontSize:12, color:C.textSub }}>
            base forecast · <span style={{ color: onPace ? C.green : C.red, fontWeight:600 }}>{fmtPct(d.pctOfTarget)} of $3M target</span>
            <InfoTooltip>
              <div style={{ marginBottom:6 }}><strong>How scenarios are defined:</strong></div>
              <div style={{ marginBottom:4 }}><strong style={{color:'#F1EFE8'}}>Base:</strong> Year 1 monthly quote volume × cohort-specific dollar-weighted close rates, across remaining Year 2 quote-generating days (accounts for 86-day non-INET sales cycle)</div>
              <div style={{ marginBottom:4 }}><strong style={{color:'#F1EFE8'}}>Bear:</strong> 2nd-worst month of Year 1 used as steady-state input</div>
              <div style={{ marginBottom:4 }}><strong style={{color:'#F1EFE8'}}>Bull:</strong> Trailing 90-day quote pace projected forward, only when it exceeds Year 1 average. Otherwise equals base.</div>
              <div style={{ marginTop:6, fontStyle:'italic', opacity:0.85 }}>All scenarios exclude XL ($50K+) quotes and ad-hoc T&amp;M orders.</div>
            </InfoTooltip>
          </div>
        </div>

        <div style={{ fontSize:12, color:C.textSub, marginBottom:14 }}>
          Range: <span style={{ color:C.text, fontWeight:600 }}>{fmtCurrency(d.forecastBear)} bear</span> — {fmtCurrency(d.forecastBase)} base — <span style={{ color:C.text, fontWeight:600 }}>{fmtCurrency(d.forecastBull)} bull</span> · excludes XL upside
        </div>

        <div style={{ marginBottom:6 }}>
          <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Composition <span style={{ color:C.textMuted }}>· click a segment to drill down</span></div>
          <div style={{ display:'flex', height:28, borderRadius:4, overflow:'hidden', border:`0.5px solid ${C.border}` }}>
            <ForecastSegment color="#3B6D11" width={pct(d.yr2Rev)} label="Collected" value={d.yr2Rev} showLabel={false}
              onClick={() => setDrill({ title:'Collected — Year 2 paid invoices', type:'invoices-paid',
                items: data.invoices.filter(r => r.yearBucket === 'Year 2') })} />
            <ForecastSegment color="#639922" width={pct(d.arWeighted)} label="AR" value={d.arWeighted} showLabel={false}
              onClick={() => setDrill({ title:'AR — invoiced, unpaid', type:'invoices-unpaid',
                items: data.unpaid })} />
            <ForecastSegment color="#97C459" width={pct(d.flightWeighted)} label="in flight" value={d.flightWeighted} showLabel={true}
              onClick={() => setDrill({ title:'Jobs in flight — won, awaiting invoicing', type:'backlog',
                items: data.orders.filter(r => r.isBacklog) })} />
            <ForecastSegment color="#C0DD97" width={pct(d.pipelineWeighted)} label="pipeline" value={d.pipelineWeighted} showLabel={true}
              onClick={() => setDrill({ title:'Open pipeline — weighted', type:'pipeline',
                items: data.orders.filter(r => r.isOpen && !r.isInet && r.cohort !== 'XL $50K+') })} />
            <ForecastSegment color="#EAF3DE" width={pct(d.futureBase)} label="future quotes" value={d.futureBase} showLabel={true} lightText />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:C.textMuted }}>
            <span>Collected {fmtCurrency(d.yr2Rev)} · AR {fmtCurrency(d.arWeighted)}</span>
            <span>← committed · need to generate →</span>
          </div>
        </div>

        <div style={{ background: onPace ? C.greenBg : C.redBg, borderRadius:8, padding:'9px 13px', marginTop:12, fontSize:12, color: onPace ? C.greenTxt : C.redTxt }}>
          <span style={{ fontWeight:600 }}>{paceText}</span> {paceDetail}
        </div>
      </div>

      {/* BLOCK 2: XL bounty */}
      {d.xlBounty.length > 0 && (
        <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.05em' }}>XL bounty · open $50K+ quotes</div>
            <div style={{ fontSize:12, color:C.textMuted }}>
              {d.xlBounty.length} open · {fmtCurrency(d.xlBountyFace)} face · not in forecast · Year 1 win rate 7%
            </div>
          </div>
          <div style={{ borderTop:`0.5px solid ${C.border}` }}>
            {d.xlBounty.map(x => {
              const fullOrder = openXLOrders.find(r => r.order_number === x.order_number);
              return (
                <div key={x.order_number}
                  onClick={() => setOrderDetail(fullOrder)}
                  style={{ display:'grid', gridTemplateColumns:'60px 1.5fr 1.2fr 90px', gap:8, padding:'8px 0', borderBottom:`0.5px solid ${C.border}`, fontSize:12, alignItems:'center', cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f8fc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ color:C.textMuted }}>#{x.order_number}</span>
                  <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{x.order_name || '—'}</span>
                  <span style={{ color:C.textSub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{x.customer} / {x.pm}</span>
                  <span style={{ color:C.text, fontWeight:600, textAlign:'right' }}>{fmtCurrency(x.gt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOCK 3: Momentum */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.05em' }}>Quote momentum · last 30 days</div>
          <div style={{ fontSize:11, color:C.textMuted }}>
            all channels · formal quotes only
            <InfoTooltip>Includes non-INET formal quotes (went through Labor Quote Presented stage) AND all INET requests from PYR200. Excludes ad-hoc T&amp;M orders that skip the formal quoting stage.</InfoTooltip>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:10, marginBottom:12 }}>
          <MomentumCard
            label="Total quotes"
            sub="(value)"
            value={`${d.totalQuotes30}`}
            valueSub={fmtCurrency(d.totalQuotesDollars30)}
            delta={d.totalQuotesDelta}
            baselineLabel={`${d.y1MonthlyTotalQuotes}/mo avg`}
            onClick={() => setDrill({ title:`Last 30 days · ${d.totalQuotes30} quotes`, type:'quotes', items: d.totalQuotes30Items })}
          />
          <MomentumCard
            label="Non-INET formal only"
            value={`${d.nonInetFormalQuotes30}`}
            delta={d.nonInetQuotesDelta}
            baselineLabel={`${d.y1MonthlyNonInetFormal}/mo avg`}
            onClick={() => setDrill({ title:`Non-INET formal · ${d.nonInetFormalQuotes30} quotes`, type:'quotes', items: d.nonInetFormalQuotes30Items })}
          />
          <MomentumCard
            label="New PMs this month"
            value={`${d.newPMs30}`}
            valueColor={d.newPMs30 > 0 ? C.green : C.red}
            footerText={d.newPMs30 > 0 ? 'first-ever quote' : 'none in 30 days'}
            footerColor={d.newPMs30 > 0 ? C.textMuted : C.red}
            onClick={d.newPMs30 > 0 ? () => setDrill({ title:'New PMs (last 30 days)', type:'newPMs', items: d.newPMs30Items }) : null}
          />
          <MomentumCard
            label="New dealers"
            value={`${d.newDealers60}`}
            valueColor={d.newDealers60 > 0 ? C.green : C.red}
            footerText={d.newDealers60 > 0 ? 'last 60 days' : 'none in 60 days'}
            footerColor={d.newDealers60 > 0 ? C.textMuted : C.red}
            onClick={d.newDealers60 > 0 ? () => setDrill({ title:'New dealers (last 60 days)', type:'newDealers', items: d.newDealers60Items }) : null}
          />
        </div>

        <MomentumBanner
          totalDelta={d.totalQuotesDelta}
          newPMs={d.newPMs30}
          newDealers={d.newDealers60}
        />
      </div>

      {/* BLOCK 4: This week's attention */}
      {d.attentionList.length > 0 && (
        <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.05em' }}>This week's attention</div>
            <div style={{ fontSize:11, color:C.textMuted }}>click a row for details · resolves when IQ / INET data updates</div>
          </div>
          <div>
            {d.attentionList.map((item, i) => (
              <div key={item.key}
                onClick={() => setDrill({ title:`${item.label} (${item.count})`, type:item.itemType, items:item.items })}
                style={{ display:'grid', gridTemplateColumns:'32px minmax(0,1fr) auto', gap:10, padding:'10px 0', borderBottom: i < d.attentionList.length - 1 ? `0.5px solid ${C.border}` : 'none', alignItems:'center', cursor:'pointer', transition:'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f8fc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{
                  background: item.severity === 'red' ? C.redBg : C.amberBg,
                  color: item.severity === 'red' ? C.redTxt : C.amberTxt,
                  fontSize:11, fontWeight:600, padding:'3px 0', borderRadius:10, textAlign:'center'
                }}>{item.count}</span>
                <span style={{ fontSize:13, color:C.text, minWidth:0, overflow:'hidden' }}>
                  <span style={{ fontWeight:600 }}>{item.label}</span>
                  <span style={{ color:C.textSub }}> — {item.detail}</span>
                </span>
                <span style={{ fontSize:12, color:C.textSub, fontWeight:600, whiteSpace:'nowrap' }}>
                  {item.amount !== null && item.amount !== undefined ? fmtCurrency(item.amount) : item.amountLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOCK 5: Customer concentration */}
      <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Customer concentration · health indicator</div>

        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 70px', gap:12, paddingBottom:6, borderBottom:`0.5px solid ${C.border}`, fontSize:10, fontWeight:600, color:C.textMuted, textTransform:'uppercase' }}>
          <div>Customer</div>
          <div>Year 1</div>
          <div>Year 2 so far</div>
          <div style={{ textAlign:'center' }}>Trend</div>
        </div>
        {d.concentration.map((c, i) => {
          const customerInvoices = [
            ...data.invoices.filter(inv => inv.customer === c.customer || inv.customer.startsWith(c.customer.replace('…',''))),
          ];
          return (
            <div key={c.customer}
              onClick={() => setDrill({ title:`${c.customer} — revenue history`, type:'customer-invoices', items: customerInvoices, customerName: c.customer })}
              style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 70px', gap:12, padding:'7px 0', borderBottom: i < d.concentration.length - 1 ? `0.5px solid ${C.border}` : 'none', fontSize:12, alignItems:'center', cursor:'pointer', transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f8fc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.customer}</div>
              <div style={{ color:C.text }}>
                {fmtCurrency(c.y1Rev)} <span style={{ color: c.y1Pct > 0.35 ? C.red : C.textSub }}>({fmtPct(c.y1Pct)})</span>
              </div>
              <div style={{ color:C.text }}>
                {fmtCurrency(c.y2Rev)} <span style={{ color:C.textSub }}>({fmtPct(c.y2Pct)})</span>
              </div>
              <div style={{ textAlign:'center', fontSize:14 }}>
                {c.trend === 'tm-ends' && <span style={{ color:C.textMuted, fontSize:11 }}>T&amp;M ends</span>}
                {c.trend === 'up' && <span style={{ color:C.amber }}>↑</span>}
                {c.trend === 'down' && <span style={{ color:C.green }}>↓</span>}
                {c.trend === 'neutral' && <span style={{ color:C.textSub }}>—</span>}
              </div>
            </div>
          );
        })}

        <div style={{ fontSize:11, color:C.textMuted, marginTop:12 }}>
          No customer dominates. Year 1: {d.newPMsY1} new PMs (3+ quotes) and {d.newDealersY1} new dealers brought into the book. The right direction.
        </div>
      </div>

      {/* DRILL DOWN MODAL */}
      {drill && (
        <Modal wide title={drill.title} onClose={() => setDrill(null)}>
          <DrillTable drill={drill} onOrderClick={setOrderDetail} />
        </Modal>
      )}

      {/* ORDER DETAIL MODAL */}
      {orderDetail && (
        <Modal title={`Order #${orderDetail.order_number}`} onClose={() => setOrderDetail(null)}>
          <DetailRow label="Order name" value={orderDetail.order_name || '—'} />
          <DetailRow label="Customer" value={orderDetail.customer} />
          <DetailRow label="PM" value={orderDetail.pm} />
          <DetailRow label="Salesperson" value={orderDetail.salesperson} />
          <DetailRow label="Status" value={orderDetail.status} />
          <DetailRow label="Face value" value={fmtCurrency(orderDetail.gt)} />
          <DetailRow label="Cohort" value={orderDetail.cohort} />
          {orderDetail.pipelineCR !== null && orderDetail.pipelineCR !== undefined && (
            <>
              <DetailRow label="Win rate" value={`${Math.round(orderDetail.pipelineCR * 100)}%${orderDetail.pipelineCRSource ? ` (${orderDetail.pipelineCRSource})` : ''}`} />
              <DetailRow label="Weighted value" value={fmtCurrency(orderDetail.pipelineWeighted || 0)} />
            </>
          )}
          {orderDetail.lqp_start_date && <DetailRow label="Presented" value={orderDetail.lqp_start_date} />}
          {orderDetail.daysPresented !== null && orderDetail.daysPresented !== undefined && <DetailRow label="Days presented" value={`${orderDetail.daysPresented} days`} />}
          {orderDetail.expiry_date && <DetailRow label="Expires" value={orderDetail.expiry_date} />}
          {orderDetail.daysToExpiry !== null && orderDetail.daysToExpiry !== undefined && <DetailRow label="Days to expiry" value={`${orderDetail.daysToExpiry} days`} />}
          {orderDetail.modification_notes && (
            <div style={{ marginTop:12, fontSize:12, color:C.textSub }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Notes:</div>
              <div style={{ whiteSpace:'pre-wrap' }}>{orderDetail.modification_notes}</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── LOCAL COMPONENTS ──

function ForecastSegment({ color, width, label, value, showLabel, lightText, onClick }) {
  const textColor = lightText ? '#173404' : '#173404';
  return (
    <div
      onClick={onClick}
      title={`${label} ${value ? '$' + Math.round(value/1000) + 'K' : ''}`}
      style={{
        background: color,
        width: `${width}%`,
        minWidth: value > 0 ? 4 : 0,
        display: 'flex', alignItems: 'center', padding: showLabel ? '0 6px' : 0,
        color: textColor, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
      }}>
      {showLabel && width > 10 && value > 0 && `$${Math.round(value / 1000)}K ${label}`}
    </div>
  );
}

function MomentumCard({ label, sub, value, valueSub, valueColor, delta, baselineLabel, footerText, footerColor, onClick }) {
  let deltaText = null, deltaColor = null;
  if (delta !== undefined && delta !== null) {
    const pct = Math.round(delta * 100);
    if (pct > 0) { deltaText = `↑ ${pct}% vs ${baselineLabel}`; deltaColor = C.green; }
    else if (pct < 0) {
      deltaText = `↓ ${Math.abs(pct)}% vs ${baselineLabel}`;
      deltaColor = pct < -20 ? C.red : C.amber;
    } else {
      deltaText = `flat vs ${baselineLabel}`; deltaColor = C.textMuted;
    }
  }

  return (
    <div
      onClick={onClick}
      style={{ background:'#f0f2f5', borderRadius:8, padding:'10px 12px', cursor: onClick ? 'pointer' : 'default', transition:'background 0.1s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = '#e6edf5')}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = '#f0f2f5')}>
      <div style={{ fontSize:11, color:C.textSub }}>
        {label} {sub && <span style={{ color:C.textMuted }}>{sub}</span>}
      </div>
      <div style={{ fontSize:20, fontWeight:600, color: valueColor || C.text, marginTop:2 }}>
        {value} {valueSub && <span style={{ fontSize:13, color:C.textSub, fontWeight:400 }}>({valueSub})</span>}
      </div>
      {deltaText && <div style={{ fontSize:11, color: deltaColor, marginTop:2 }}>{deltaText}</div>}
      {footerText && <div style={{ fontSize:11, color: footerColor || C.textMuted, marginTop:2 }}>{footerText}</div>}
    </div>
  );
}

function MomentumBanner({ totalDelta, newPMs, newDealers }) {
  const quotesHealthy = totalDelta >= -0.1;
  const concerns = [];
  if (newDealers === 0) concerns.push('no new dealers in 60 days');
  if (newPMs === 0) concerns.push('no new PMs in 30 days');
  if (totalDelta < -0.2) concerns.push('quote volume is well below Year 1 average');

  if (quotesHealthy && concerns.length === 0) {
    return (
      <div style={{ background:C.greenBg, borderRadius:8, padding:'10px 13px', fontSize:12, color:C.greenTxt, borderLeft:`3px solid ${C.green}` }}>
        <span style={{ fontWeight:600 }}>Strong quote flow.</span> Volume above Year 1 averages and new sources coming in. Keep pushing.
      </div>
    );
  }

  if (quotesHealthy && concerns.length > 0) {
    return (
      <div style={{ background:C.greenBg, borderRadius:8, padding:'10px 13px', fontSize:12, color:C.greenTxt, borderLeft:`3px solid ${C.green}` }}>
        <span style={{ fontWeight:600 }}>Strong quote flow.</span> Volume above average. One gap: {concerns.join('; ')} — keep looking for new sources.
      </div>
    );
  }

  return (
    <div style={{ background:C.amberBg, borderRadius:8, padding:'10px 13px', fontSize:12, color:C.amberTxt, borderLeft:`3px solid ${C.amber}` }}>
      <span style={{ fontWeight:600 }}>Early warning:</span> {concerns.join('; ')}. If this pattern holds, Year 2 forecast drops. Drive more quotes this week.
    </div>
  );
}

function DrillTable({ drill, onOrderClick }) {
  const { type, items } = drill;

  // Define columns based on type
  const cols = (() => {
    switch (type) {
      case 'quote': // expiring14
        return [
          { key:'order_number', label:'#', width:'10%' },
          { key:'customer', label:'Customer', width:'22%' },
          { key:'pm', label:'PM', width:'18%' },
          { key:'gt', label:'Value', width:'13%', render:v => fmtCurrency(v) },
          { key:'daysToExpiry', label:'Days left', width:'12%',
            render:v => <Badge type={v<=14?'red':'amber'}>{v}d</Badge> },
          { key:'expiry_date', label:'Expires', width:'15%' },
        ];
      case 'order': // RTI or approved aging
        return [
          { key:'order_number', label:'#', width:'10%' },
          { key:'customer', label:'Customer', width:'22%' },
          { key:'pm', label:'PM', width:'18%' },
          { key:'status', label:'Status', width:'18%' },
          { key:'gt', label:'Face', width:'12%', render:v => fmtCurrency(v) },
          { key:'daysInStatus', label:'Days', width:'10%',
            render:v => <Badge type={v>90?'red':v>30?'amber':'gray'}>{v}d</Badge> },
        ];
      case 'invoice': // overdue invoices
        return [
          { key:'invoice_ref', label:'Invoice #', width:'11%' },
          { key:'customer', label:'Customer', width:'24%' },
          { key:'invoice_name', label:'Invoice name', width:'28%' },
          { key:'gt', label:'Amount', width:'13%', render:v => fmtCurrency(v) },
          { key:'due_date', label:'Due', width:'12%' },
          { key:'agingDaysDue', label:'Past due', width:'12%',
            render:v => <Badge type={Math.abs(v)>60?'red':'amber'}>{Math.abs(v)}d</Badge> },
        ];
      case 'pm': // cold PMs
        return [
          { key:'pm', label:'PM', width:'35%' },
          { key:'lastQuoteDate', label:'Last quote', width:'18%' },
          { key:'daysSilent', label:'Days silent', width:'14%',
            render:v => <Badge type={v>60?'red':'amber'}>{v}d</Badge> },
          { key:'y1Count', label:'Y1 quotes', width:'14%' },
        ];
      case 'dealer': // cold dealers
        return [
          { key:'customer', label:'Dealer', width:'40%' },
          { key:'lastQuoteDate', label:'Last quote', width:'20%' },
          { key:'daysSilent', label:'Days silent', width:'14%',
            render:v => <Badge type={v>120?'red':'amber'}>{v}d</Badge> },
          { key:'y1Count', label:'Y1 quotes', width:'14%' },
        ];
      case 'quotes': // momentum drill-down
        return [
          { key:'type', label:'Type', width:'10%',
            render:v => <Badge type={v==='INET'?'purple':'blue'}>{v}</Badge> },
          { key:'number', label:'#', width:'11%' },
          { key:'customer', label:'Customer', width:'20%' },
          { key:'name', label:'Name', width:'24%' },
          { key:'pm', label:'PM', width:'16%' },
          { key:'value', label:'Face', width:'12%', render:v => fmtCurrency(v) },
        ];
      case 'newPMs':
        return [
          { key:'pm', label:'PM', width:'35%' },
          { key:'dealer', label:'Dealer', width:'30%' },
          { key:'firstDate', label:'First quote', width:'17%' },
          { key:'quoteCount', label:'Quotes', width:'14%' },
        ];
      case 'newDealers':
        return [
          { key:'customer', label:'Dealer', width:'50%' },
          { key:'firstDate', label:'First quote', width:'22%' },
          { key:'quoteCount', label:'Quotes', width:'22%' },
        ];
      case 'invoices-paid':
        return [
          { key:'invoice_ref', label:'Invoice #', width:'11%' },
          { key:'customer', label:'Customer', width:'28%' },
          { key:'invoice_name', label:'Name', width:'33%' },
          { key:'payment_date', label:'Paid date', width:'14%' },
          { key:'gt', label:'Amount', width:'12%', render:v => fmtCurrency(v) },
        ];
      case 'invoices-unpaid':
        return [
          { key:'invoice_ref', label:'Invoice #', width:'11%' },
          { key:'customer', label:'Customer', width:'24%' },
          { key:'invoice_name', label:'Name', width:'27%' },
          { key:'gt', label:'Amount', width:'13%', render:v => fmtCurrency(v) },
          { key:'due_date', label:'Due', width:'13%' },
          { key:'payment_status', label:'Status', width:'10%',
            render:v => <Badge type={v==='Partial'?'amber':'gray'}>{v}</Badge> },
        ];
      case 'backlog':
        return [
          { key:'order_number', label:'#', width:'10%' },
          { key:'customer', label:'Customer', width:'22%' },
          { key:'pm', label:'PM', width:'18%' },
          { key:'status', label:'Status', width:'18%' },
          { key:'remaining', label:'Remaining', width:'14%', render:(v,r) => fmtCurrency(v || r.gt) },
          { key:'backlogTier', label:'Tier', width:'16%',
            render:v => v ? <Badge type={v==='On track'?'green':v==='Ready to invoice'?'green':v==='Slight delay'?'amber':'red'}>{v}</Badge> : '—' },
        ];
      case 'pipeline':
        return [
          { key:'order_number', label:'#', width:'10%' },
          { key:'customer', label:'Customer', width:'22%' },
          { key:'pm', label:'PM', width:'18%' },
          { key:'cohort', label:'Cohort', width:'14%' },
          { key:'gt', label:'Face', width:'12%', render:v => fmtCurrency(v) },
          { key:'pipelineWeighted', label:'Weighted', width:'12%', render:v => fmtCurrency(v || 0) },
          { key:'daysToExpiry', label:'Exp', width:'10%',
            render:v => v === null || v === undefined ? '—' : v < 0 ? <Badge type="gray">exp</Badge> : `${v}d` },
        ];
      case 'customer-invoices':
        return [
          { key:'invoice_ref', label:'Invoice #', width:'12%' },
          { key:'invoice_name', label:'Name', width:'38%' },
          { key:'payment_date', label:'Paid', width:'15%' },
          { key:'yearBucket', label:'Year', width:'13%' },
          { key:'gt', label:'Amount', width:'15%', render:v => fmtCurrency(v) },
        ];
      default:
        return [{ key:'summary', label:'Item' }];
    }
  })();

  const clickHandler = (['order','pipeline','backlog','quote'].includes(type) && onOrderClick)
    ? onOrderClick : null;

  return (
    <>
      <div style={{ fontSize:12, color:C.textMuted, marginBottom:10 }}>
        {items.length} item{items.length === 1 ? '' : 's'}
      </div>
      <Table cols={cols} rows={items} onRowClick={clickHandler} />
    </>
  );
}
