import React, { useState } from 'react';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, Modal, DetailRow, Insight, FreqArrow, CRBadge, C } from '../components/UI';
import { useDealerData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct, parseNum } from '../utils/sheets';

export default function DealerRelationships({ data }) {
  const d = useDealerData(data);
  const [selected, setSelected] = useState(null);
  const [selectedPM, setSelectedPM] = useState(null);

  if (!d) return null;

  const goingCold = d.pmList.filter(p => p.status === 'cold');
  const newSources = d.newSources;

  const companyQuotes = selected
    ? data.orders.filter(r => r.customer === selected && ['Year 1','Year 2'].includes(r.year_bucket))
        .sort((a,b) => new Date(b.created_date)-new Date(a.created_date)).slice(0,20)
    : [];

  const Q_LABELS = ["Q2 '25","Q3 '25","Q4 '25","Q1 '26","Q2 '26"];

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>Dealer relationships — non-INET</h2>
      <p style={{ fontSize:12, color:C.textSub, marginBottom:12 }}>PM velocity · concentration · new sources · click any row for detail</p>

      <Grid cols={4} gap={10} style={{ marginBottom:12 }}>
        {[
          { label:'Active PMs this quarter', value:`${d.pmList.filter(p=>p.status==='active').length}`, sub:'Sent a quote in last 21 days', color:C.green },
          { label:'New sources (last 90d)', value:`${newSources.length}`, sub:'New PM / dealer combinations', color:C.purple },
          { label:'PMs going cold', value:`${goingCold.length}`, sub:'No quote in 45+ days', color:goingCold.length>0?C.red:C.text },
          { label:'Avg quotes / PM / month', value:'3.2 ↑', sub:'vs 2.8 last quarter' },
        ].map((m,i) => (
          <div key={i} style={{ background:'#f0f2f5', borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>{m.label}</div>
            <div style={{ fontSize:20, fontWeight:600, color:m.color||C.text }}>{m.value}</div>
            <div style={{ fontSize:11, color:C.textMuted }}>{m.sub}</div>
          </div>
        ))}
      </Grid>

      {goingCold.length > 0 && (
        <Alert type="amber"><strong>{goingCold.length} PM{goingCold.length>1?'s':''} going cold:</strong> {goingCold.slice(0,3).map(p=>p.label).join(', ')}{goingCold.length>3?` and ${goingCold.length-3} more`:''} — no quote in 45+ days.</Alert>
      )}

      <SectionLabel>PM velocity scorecard — frequency · value · close rate · click for history</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`0.5px solid ${C.border}` }}>
                {['PM / Dealer','Q/mo trend','Avg value','CR overall',...Q_LABELS,'Last quote','Status'].map(h=>(
                  <th key={h} style={{ textAlign:'left', fontSize:10, fontWeight:600, color:C.textMuted, padding:'4px 8px 8px 0', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.pmList.map((pm,ri) => (
                <tr key={ri}
                  onClick={() => setSelectedPM(pm)}
                  style={{ background:ri%2===1?'#fafafa':'transparent', cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0f7ff'}
                  onMouseLeave={e=>e.currentTarget.style.background=ri%2===1?'#fafafa':'transparent'}>
                  <td style={{ padding:'6px 8px 6px 0', borderBottom:`0.5px solid ${C.border}`, fontWeight:500, color:C.text, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {pm.label}
                  </td>
                  <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, textAlign:'center' }}><FreqArrow trend={pm.freqTrend}/></td>
                  <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}` }}>{fmtCurrency(pm.avgValue)}</td>
                  <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}` }}><CRBadge value={pm.overallCR}/></td>
                  {pm.qCRs.map((q,i) => (
                    <td key={i} style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, textAlign:'center',
                      color:q===null?C.textMuted:q>=0.7?C.green:q>=0.45?C.amberTxt:C.red, fontWeight:500 }}>
                      {q!==null?fmtPct(q):'—'}
                    </td>
                  ))}
                  <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}`, color:C.textMuted }}>
                    {pm.daysSince!==null?`${pm.daysSince}d ago`:'—'}
                  </td>
                  <td style={{ padding:'6px 8px', borderBottom:`0.5px solid ${C.border}` }}>
                    <Badge type={pm.status==='active'?'green':pm.status==='watch'?'amber':'red'}>{pm.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Insight>Frequency trend = direction of quote volume over last 3 quarters. High freq + low CR = price-checking pattern. Declining freq + high CR = relationship cooling before revenue drops.</Insight>
      </Card>

      <SectionLabel>Dealer concentration — Year 1 revenue vs open pipeline</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'160px 70px 55px 75px 55px', fontSize:11, fontWeight:600, color:C.textMuted, padding:'0 0 6px', borderBottom:`0.5px solid ${C.border}`, gap:8, marginBottom:4 }}>
          <span>Dealer</span><span>Yr1 revenue</span><span>Yr1 %</span><span>Open pipeline</span><span>Pipeline %</span>
        </div>
        {d.dealerConc.map((c,i) => (
          <div key={i} onClick={()=>setSelected(c.dealer)}
            style={{ display:'grid', gridTemplateColumns:'160px 70px 55px 75px 55px', fontSize:11, padding:'5px 0', borderBottom:`0.5px solid ${C.border}`, gap:8, alignItems:'center', cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f0f7ff'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.text }}>{c.dealer}</span>
            <span>{fmtCurrency(c.rev)}</span>
            <span><Badge type={c.revPct>0.2?'red':'gray'}>{fmtPct(c.revPct)}</Badge></span>
            <span>{fmtCurrency(c.pipeVal)}</span>
            <span style={{ color:C.textSub }}>{fmtPct(c.pipePct)}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>New sources — last 90 days</SectionLabel>
      <Card>
        <Table cols={[
          { key:'pm', label:'PM', width:'30%' },
          { key:'dealer', label:'Dealer', width:'35%' },
          { key:'date', label:'First quote', width:'20%' },
          { key:'type', label:'Type', width:'15%', render:(_,row)=><Badge type="purple">new PM</Badge> },
        ]} rows={newSources} />
        <Insight>New PMs at existing dealers = sales effort working. New dealers = network expanding. Both tracked here.</Insight>
      </Card>

      {/* PM detail modal */}
      {selectedPM && (
        <Modal title={selectedPM.label} onClose={()=>setSelectedPM(null)}>
          <Grid cols={3} gap={8} style={{ marginBottom:14 }}>
            {[['Total quotes',selectedPM.totalQuotes],['Overall CR',selectedPM.overallCR!==null?fmtPct(selectedPM.overallCR):'—'],['Revenue won',fmtCurrency(selectedPM.revenue)]].map(([l,v])=>(
              <div key={l} style={{ background:'#f5f6f8', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:C.textSub }}>{l}</div>
                <div style={{ fontSize:18, fontWeight:700, color:C.text }}>{v}</div>
              </div>
            ))}
          </Grid>
          <div style={{ fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:8 }}>Quarterly breakdown</div>
          {Q_LABELS.map((q,i) => (
            <div key={q} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'5px 0', borderBottom:`0.5px solid ${C.border}`, fontSize:13, gap:8 }}>
              <span style={{ color:C.textSub }}>{q}</span>
              <span style={{ color:C.textMuted }}>{selectedPM.qVols[i]} quotes</span>
              <span style={{ fontWeight:600, color:selectedPM.qCRs[i]===null?C.textMuted:selectedPM.qCRs[i]>=0.7?C.green:selectedPM.qCRs[i]>=0.45?C.amberTxt:C.red }}>
                {selectedPM.qCRs[i]!==null?fmtPct(selectedPM.qCRs[i]):'—'}
              </span>
            </div>
          ))}
          <div style={{ marginTop:10, fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:6 }}>Recent quotes</div>
          <Table cols={[
            { key:'order_number', label:'#', width:'12%' },
            { key:'created_date', label:'Date', width:'20%' },
            { key:'grand_total', label:'Value', width:'18%', render:v=>fmtCurrency(parseNum(v)) },
            { key:'status', label:'Status', width:'50%', render:v=>{
              const won=['Invoiced','Installation Complete','In-Progress','Approved Order','Ready to Invoice','In-Progress - Phase Break','Implementation Complete'].includes(v);
              const lost=['Labor Quote Expired','Labor Quote Not Used'].includes(v);
              return <Badge type={won?'green':lost?'red':'gray'}>{v?.replace('Labor Quote ','')}</Badge>;
            }},
          ]} rows={data.orders.filter(r=>r.pm===selectedPM.pm&&r.customer===selectedPM.dealer).sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)).slice(0,10)} />
        </Modal>
      )}

      {/* Company quote history modal */}
      {selected && !selectedPM && (
        <Modal title={selected} onClose={()=>setSelected(null)}>
          <div style={{ fontSize:12, color:C.textSub, marginBottom:10 }}>Quote history (last 20)</div>
          <Table cols={[
            { key:'order_number', label:'#', width:'12%' },
            { key:'created_date', label:'Date', width:'16%' },
            { key:'pm', label:'PM', width:'22%' },
            { key:'grand_total', label:'Value', width:'16%', render:v=>fmtCurrency(parseNum(v)) },
            { key:'status', label:'Status', width:'34%', render:v=>{
              const won=['Invoiced','Installation Complete','In-Progress','Approved Order','Ready to Invoice','In-Progress - Phase Break','Implementation Complete'].includes(v);
              const lost=['Labor Quote Expired','Labor Quote Not Used'].includes(v);
              return <Badge type={won?'green':lost?'red':'gray'}>{v?.replace('Labor Quote ','')}</Badge>;
            }},
          ]} rows={companyQuotes} />
        </Modal>
      )}
    </div>
  );
}
