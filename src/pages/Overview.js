import React from 'react';
import { C, InfoTooltip } from '../components/UI';
import { useOverviewData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct } from '../utils/sheets';

export default function Overview({ data }) {
  const d = useOverviewData(data);
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
          <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Composition</div>
          <div style={{ display:'flex', height:28, borderRadius:4, overflow:'hidden', border:`0.5px solid ${C.border}` }}>
            <div title={`Collected ${fmtCurrency(d.yr2Rev)}`} style={{ background:'#3B6D11', width:`${pct(d.yr2Rev)}%`, minWidth: d.yr2Rev > 0 ? 4 : 0 }} />
            <div title={`AR ${fmtCurrency(d.arWeighted)}`} style={{ background:'#639922', width:`${pct(d.arWeighted)}%`, minWidth: d.arWeighted > 0 ? 4 : 0 }} />
            <div title={`Jobs in flight ${fmtCurrency(d.flightWeighted)}`} style={{ background:'#97C459', width:`${pct(d.flightWeighted)}%`, display:'flex', alignItems:'center', padding:'0 6px', color:'#173404', fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden' }}>{fmtCurrency(d.flightWeighted)} in flight</div>
            <div title={`Pipeline ${fmtCurrency(d.pipelineWeighted)}`} style={{ background:'#C0DD97', width:`${pct(d.pipelineWeighted)}%`, display:'flex', alignItems:'center', padding:'0 6px', color:'#173404', fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden' }}>{fmtCurrency(d.pipelineWeighted)} pipeline</div>
            <div title={`Future quotes ${fmtCurrency(d.futureBase)}`} style={{ background:'#EAF3DE', width:`${pct(d.futureBase)}%`, display:'flex', alignItems:'center', padding:'0 6px', color:'#173404', fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden' }}>{fmtCurrency(d.futureBase)} future quotes</div>
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
            {d.xlBounty.map(x => (
              <div key={x.order_number} style={{ display:'grid', gridTemplateColumns:'60px 1.5fr 1.2fr 90px', gap:8, padding:'8px 0', borderBottom:`0.5px solid ${C.border}`, fontSize:12, alignItems:'center' }}>
                <span style={{ color:C.textMuted }}>#{x.order_number}</span>
                <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{x.order_name || '—'}</span>
                <span style={{ color:C.textSub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{x.customer} / {x.pm}</span>
                <span style={{ color:C.text, fontWeight:600, textAlign:'right' }}>{fmtCurrency(x.gt)}</span>
              </div>
            ))}
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
          />
          <MomentumCard
            label="Non-INET formal only"
            value={`${d.nonInetFormalQuotes30}`}
            delta={d.nonInetQuotesDelta}
            baselineLabel={`${d.y1MonthlyNonInetFormal}/mo avg`}
          />
          <MomentumCard
            label="New PMs this month"
            value={`${d.newPMs30}`}
            valueColor={d.newPMs30 > 0 ? C.green : C.red}
            footerText={d.newPMs30 > 0 ? 'first-ever quote' : 'none in 30 days'}
            footerColor={d.newPMs30 > 0 ? C.textMuted : C.red}
          />
          <MomentumCard
            label="New dealers"
            value={`${d.newDealers60}`}
            valueColor={d.newDealers60 > 0 ? C.green : C.red}
            footerText={d.newDealers60 > 0 ? 'last 60 days' : 'none in 60 days'}
            footerColor={d.newDealers60 > 0 ? C.textMuted : C.red}
          />
        </div>

        <MomentumBanner
          totalDelta={d.totalQuotesDelta}
          nonInetDelta={d.nonInetQuotesDelta}
          newPMs={d.newPMs30}
          newDealers={d.newDealers60}
        />
      </div>

      {/* BLOCK 4: This week's attention */}
      {d.attentionList.length > 0 && (
        <div style={{ background:'#fff', border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 18px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:C.textMuted, textTransform:'uppercase', letterSpacing:'.05em' }}>This week's attention</div>
            <div style={{ fontSize:11, color:C.textMuted }}>resolves when IQ / INET data updates</div>
          </div>
          <div>
            {d.attentionList.map((item, i) => (
              <div key={item.key} style={{ display:'grid', gridTemplateColumns:'32px 1fr auto', gap:10, padding:'10px 0', borderBottom: i < d.attentionList.length - 1 ? `0.5px solid ${C.border}` : 'none', alignItems:'center' }}>
                <span style={{
                  background: item.severity === 'red' ? C.redBg : C.amberBg,
                  color: item.severity === 'red' ? C.redTxt : C.amberTxt,
                  fontSize:11, fontWeight:600, padding:'3px 0', borderRadius:10, textAlign:'center'
                }}>{item.count}</span>
                <span style={{ fontSize:13, color:C.text }}>
                  <span style={{ fontWeight:600 }}>{item.label}</span>
                  <span style={{ color:C.textSub }}> — {item.detail}</span>
                </span>
                <span style={{ fontSize:12, color:C.textSub, fontWeight:600 }}>
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
        {d.concentration.map((c, i) => (
          <div key={c.customer} style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 70px', gap:12, padding:'7px 0', borderBottom: i < d.concentration.length - 1 ? `0.5px solid ${C.border}` : 'none', fontSize:12, alignItems:'center' }}>
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
        ))}

        <div style={{ fontSize:11, color:C.textMuted, marginTop:12 }}>
          No customer dominates. Year 1: {d.newPMsY1} new PMs (3+ quotes) and {d.newDealersY1} new dealers brought into the book. The right direction.
        </div>
      </div>
    </div>
  );
}

function MomentumCard({ label, sub, value, valueSub, valueColor, delta, baselineLabel, footerText, footerColor }) {
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
    <div style={{ background:'#f0f2f5', borderRadius:8, padding:'10px 12px' }}>
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
