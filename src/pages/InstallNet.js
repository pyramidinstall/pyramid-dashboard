import React, { useState } from 'react';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, Modal, DetailRow, Insight, FreqArrow, CRBadge, TrendArrow, C } from '../components/UI';
import { useInetData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct, parseNum, parseBool } from '../utils/sheets';

export default function InstallNet({ data }) {
  const d = useInetData(data);
  const [selectedPM, setSelectedPM] = useState(null);
  if (!d) return null;

  const alerts = d.pmList.filter(p => p.crAlert);
  const Q_LABELS = ["Q2 '25","Q3 '25","Q4 '25","Q1 '26","Q2 '26"];

  const pmQuotes = selectedPM
    ? data.installnet.filter(r => r.pm === selectedPM.pm && ['Year 1','Year 2'].includes(r.year_bucket))
        .sort((a,b)=>new Date(b.date_requested)-new Date(a.date_requested)).slice(0,15)
    : [];

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>INSTALL Net</h2>
      <p style={{ fontSize:12, color:C.textSub, marginBottom:12 }}>SP velocity by PM · close rate trends · no-bid tracking · loss analysis</p>

      <Grid cols={4} gap={10} style={{ marginBottom:12 }}>
        {[
          { label:'SP close rate (Year 1)', value:fmtPct(d.overallCR), sub:`${d.wonCount} won / ${d.decidedCount} decided (ex-passed)`, color:C.green },
          { label:'Awarded revenue (Year 1)', value:fmtCurrency(d.revenue), sub:'From INSTALL Net portal data' },
          { label:'Passed (no bid)', value:d.passedCount, sub:'Your choice — not competitive losses', color:C.gray },
          { label:'Avg response time', value:'1.9 hrs', sub:'Year 1 median' },
        ].map((m,i) => (
          <div key={i} style={{ background:'#f0f2f5', borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>{m.label}</div>
            <div style={{ fontSize:20, fontWeight:600, color:m.color||C.text }}>{m.value}</div>
            <div style={{ fontSize:11, color:C.textMuted }}>{m.sub}</div>
          </div>
        ))}
      </Grid>

      {alerts.length > 0 && (
        <Alert type="amber">
          <strong>Close rate alerts:</strong>{' '}
          {alerts.map(a=>`${a.pm}: ${fmtPct(a.qCRs[2])} → ${fmtPct(a.qCRs[3])} Q1 2026`).join(' · ')}
          {' '}— confirmed declines, all decided quotes. Investigate pricing competitiveness with INSTALL Net.
        </Alert>
      )}

      <SectionLabel>PM velocity scorecard — frequency · value · close rate · click for detail</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`0.5px solid ${C.border}` }}>
                {['PM','Q/mo trend','Avg value','CR overall',...Q_LABELS,'No-bid','Last quote'].map(h=>(
                  <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:600, color:C.textMuted, padding:'4px 8px 8px 0', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.pmList.map((pm,ri) => {
                const isAlert = pm.crAlert;
                return (
                  <tr key={ri}
                    onClick={()=>setSelectedPM(pm)}
                    style={{ background:isAlert?'#fff9f0':ri%2===1?'#fafafa':'transparent', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0f7ff'}
                    onMouseLeave={e=>e.currentTarget.style.background=isAlert?'#fff9f0':ri%2===1?'#fafafa':'transparent'}>
                    <td style={{ padding:'6px 8px 6px 0', borderBottom:`0.5px solid ${C.border}`, fontWeight:500, color:C.text, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {pm.pm}{isAlert&&<span style={{color:C.red,marginLeft:4}}>⚠</span>}
                    </td>
                    <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, textAlign:'center' }}><FreqArrow trend={pm.freqTrend}/></td>
                    <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}` }}>{fmtCurrency(pm.avgValue)}</td>
                    <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}` }}><CRBadge value={pm.overallCR}/></td>
                    {pm.qCRs.map((q,i) => (
                      <td key={i} style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, textAlign:'center',
                        color:q===null?C.textMuted:q>=0.7?C.green:q>=0.45?C.amberTxt:C.red, fontWeight:isAlert&&i===3?700:500 }}>
                        {q!==null?fmtPct(q):'—'}
                      </td>
                    ))}
                    <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, fontSize:11,
                      color:pm.qNoBid?.some(n=>n>=2)?C.amberTxt:C.textMuted }}>
                      {pm.qNoBid?pm.qNoBid.join('/'):'-'}
                    </td>
                    <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, color:C.textMuted, whiteSpace:'nowrap' }}>
                      {pm.daysSince!==null?`${pm.daysSince}d ago`:'—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Insight>Frequency trend = direction of quote volume. High freq + 0% CR = price-checking. Declining freq + high CR = relationship cooling. Both patterns visible here. No-bid counts show quarters where you passed.</Insight>
      </Card>

      <SectionLabel>Loss reasons — Year 1</SectionLabel>
      <Card>
        {Object.entries(d.lossReasons).sort(([,a],[,b])=>b-a).map(([reason,count],i) => {
          const total = Object.values(d.lossReasons).reduce((s,v)=>s+v,0);
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ width:210, fontSize:12, color:C.textSub, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{reason}</div>
              <div style={{ flex:1, height:7, background:'#f0f2f5', borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:`${count/total*100}%`, height:'100%', background:C.blue, borderRadius:4 }}/>
              </div>
              <div style={{ width:30, textAlign:'right', fontSize:12, color:C.text, fontWeight:500 }}>{count}</div>
            </div>
          );
        })}
        <Insight>9 of 10 response-time losses show turnaround under 3hrs — likely a data quality issue with INSTALL Net. Only project 500809 (24.6hrs Thursday evening) is a genuine slow response.</Insight>
      </Card>

      {selectedPM && (
        <Modal title={selectedPM.pm} onClose={()=>setSelectedPM(null)}>
          <Grid cols={3} gap={8} style={{ marginBottom:14 }}>
            {[['Total quotes',selectedPM.totalQuotes],['Overall CR',selectedPM.overallCR!==null?fmtPct(selectedPM.overallCR):'—'],['Revenue won',fmtCurrency(selectedPM.revenue)],['Passed (no bid)',selectedPM.passed],['Avg value',fmtCurrency(selectedPM.avgValue)],['Last quote',selectedPM.daysSince!==null?`${selectedPM.daysSince}d ago`:'—']].map(([l,v])=>(
              <div key={l} style={{ background:'#f5f6f8', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:C.textSub }}>{l}</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{v}</div>
              </div>
            ))}
          </Grid>
          <div style={{ fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:8 }}>Quarterly breakdown</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', fontSize:11, fontWeight:600, color:C.textMuted, padding:'0 0 5px', borderBottom:`0.5px solid ${C.border}`, gap:6 }}>
            <span>Quarter</span><span>Quotes</span><span>Value</span><span>CR</span><span>No-bid</span>
          </div>
          {Q_LABELS.map((q,i) => (
            <div key={q} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', padding:'5px 0', borderBottom:`0.5px solid ${C.border}`, fontSize:13, gap:6 }}>
              <span style={{ color:C.textSub }}>{q}</span>
              <span>{selectedPM.qVols[i]||0}</span>
              <span>{fmtCurrency(selectedPM.qVals?.[i]||0)}</span>
              <span style={{ fontWeight:600, color:selectedPM.qCRs[i]===null?C.textMuted:selectedPM.qCRs[i]>=0.7?C.green:selectedPM.qCRs[i]>=0.45?C.amberTxt:C.red }}>
                {selectedPM.qCRs[i]!==null?fmtPct(selectedPM.qCRs[i]):'—'}
              </span>
              <span style={{ color:selectedPM.qNoBid?.[i]>0?C.amberTxt:C.textMuted }}>{selectedPM.qNoBid?.[i]||0}</span>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
