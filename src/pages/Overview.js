import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardTitle, MetricCard, SectionLabel, Grid, Alert, Badge, Table, Insight, C } from '../components/UI';
import { useOverviewData } from '../utils/dataHooks';
import { fmtCurrency, fmtPct, parseNum } from '../utils/sheets';

const ENGINES = [
  { label:'INSTALL Net', sub:'$40K/mo avg · 77.8% SP win rate', val:'$485K/yr', pct:55, color:C.blue },
  { label:'Non-INET base (XS/S/M)', sub:'~$50K/mo · most predictable layer', val:'$606K/yr', pct:68, color:C.purple },
  { label:'Non-INET large (L cohort)', sub:'~$55K/mo · primary growth lever', val:'$662K/yr', pct:74, color:C.amber },
  { label:'Skyline Windows (T&M)', sub:'~4 months remaining · ~$10K/mo', val:'~$40K rem.', pct:13, color:C.gray },
  { label:'XL jobs ($50K+)', sub:'Not in projection — see Pipeline page', val:'Upside only', pct:5, color:C.red, dashed:true },
];

export default function Overview({ data }) {
  const d = useOverviewData(data);
  const [drillTier, setDrillTier] = useState(null);
  if (!d) return null;

  const tierColors = { 'Imminent':C.green,'On track':C.green,'Slight delay':C.amber,'Check in':C.red,'Follow up':C.red };
  const backlogOrders = data.orders.filter(r => r.is_backlog === 'TRUE' && r.status !== 'Ready to Invoice');
  const filteredBacklog = drillTier ? backlogOrders.filter(r => r.backlog_conf_tier === drillTier) : backlogOrders;

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.text }}>Pyramid Office Solutions — owner dashboard</h1>
          <p style={{ fontSize:12, color:C.textSub, marginTop:2 }}>Jordan Bass · Year 2: Apr 1, 2026 – Mar 31, 2027 · $3M target</p>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:24, fontWeight:700, color:C.amber }}>Day {d.dayOfYear2}</div>
          <div style={{ fontSize:11, color:C.textMuted }}>of Year 2</div>
        </div>
      </div>

      <Grid cols={5} gap={10} style={{ marginBottom:14 }}>
        <MetricCard label="Year 1 final" value={fmtCurrency(d.yr1Rev)} sub="Apr 2025 – Mar 2026" />
        <MetricCard label="Year 2 collected" value={fmtCurrency(d.yr2Rev)} sub={`Day ${d.dayOfYear2}`} color={C.textMuted} />
        <MetricCard label="Year 2 target" value="$3.0M" sub={`Gap: ${fmtCurrency(3000000-d.yr2Rev)}`} />
        <MetricCard label="Projected at current pace" value="$1.87M" sub="Gap to $3M: $1.13M" color={C.amber} />
        <MetricCard label="Active quote sources" value={`${d.activePMs} PMs ↑`} sub={`${d.activeDealers} dealers · last 90 days`} color={C.green} highlight />
      </Grid>

      <SectionLabel>Revenue engines — projected annual at current pace</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <p style={{ fontSize:11, color:C.textMuted, marginBottom:10 }}>Historical monthly averages annualized. Baseline if next 12 months mirror Year 1.</p>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, border:`0.5px solid ${C.border}`, marginBottom:6, background:'#f5f6f8' }}>
          <div style={{ width:180, flexShrink:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Total at current pace</div>
            <div style={{ fontSize:11, color:C.textSub }}>All engines combined</div>
          </div>
          <div style={{ flex:1, height:6, background:'#e8eaed', borderRadius:3, overflow:'hidden', maxWidth:100 }}>
            <div style={{ width:'62%', height:'100%', background:C.green, borderRadius:3 }} />
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:C.text, width:80, textAlign:'right', flexShrink:0 }}>$1.87M/yr</div>
        </div>
        {ENGINES.map((e,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, border:`0.5px ${e.dashed?'dashed':'solid'} ${C.border}`, marginBottom:6, opacity:e.dashed?0.7:1 }}>
            <div style={{ width:180, flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{e.label}</div>
              <div style={{ fontSize:11, color:C.textSub }}>{e.sub}</div>
            </div>
            <div style={{ flex:1, height:6, background:'#e8eaed', borderRadius:3, overflow:'hidden', maxWidth:100 }}>
              <div style={{ width:`${e.pct}%`, height:'100%', background:e.color, borderRadius:3 }} />
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:C.text, width:80, textAlign:'right', flexShrink:0 }}>{e.val}</div>
          </div>
        ))}
      </Card>

      <SectionLabel>Forward visibility — two funnels</SectionLabel>
      <Grid cols={2} gap={10} style={{ marginBottom:0 }}>
        <Card>
          <CardTitle>Pipeline — open quotes</CardTitle>
          <div style={{ fontSize:11, color:C.textSub, marginBottom:5 }}>All open quotes — gross face value, no adjustment</div>
          <div style={{ width:'100%', height:32, background:'#e8eaed', borderRadius:4, overflow:'hidden', marginBottom:4 }}>
            <div style={{ width:'100%', height:'100%', background:'#B5D4F4', display:'flex', alignItems:'center', paddingLeft:10 }}>
              <span style={{ fontSize:12, fontWeight:600, color:'#0C447C', whiteSpace:'nowrap' }}>{fmtCurrency(d.pipelineFace)} face value</span>
            </div>
          </div>
          <div style={{ textAlign:'center', fontSize:11, color:C.textMuted, margin:'3px 0' }}>▼ weighted by PM / dealer / cohort close rates — 39% effective</div>
          <div style={{ fontSize:11, color:C.textSub, marginBottom:5 }}>Expected revenue from current pipeline</div>
          <div style={{ width:'100%', height:36, background:'#e8eaed', borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:'39%', height:'100%', background:C.green, display:'flex', alignItems:'center', paddingLeft:10 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmtCurrency(d.pipelineWeighted)} weighted</span>
            </div>
          </div>
          <Insight>INET $1.12M → $483K (43%) · Non-INET $1.30M → $457K (35%). See Pipeline page for drill-down.</Insight>
        </Card>

        <Card>
          <CardTitle>Jobs in flight — won, awaiting invoicing</CardTitle>
          <div style={{ fontSize:11, color:C.textSub, marginBottom:5 }}>All won jobs — gross face value, no adjustment</div>
          <div style={{ width:'100%', height:32, background:'#e8eaed', borderRadius:4, overflow:'hidden', marginBottom:4 }}>
            <div style={{ width:'100%', height:'100%', background:'#C0DD97', display:'flex', alignItems:'center', paddingLeft:10 }}>
              <span style={{ fontSize:12, fontWeight:600, color:'#27500A', whiteSpace:'nowrap' }}>{fmtCurrency(d.totalFlightFace)} face value</span>
            </div>
          </div>
          <div style={{ textAlign:'center', fontSize:11, color:C.textMuted, margin:'3px 0' }}>▼ confidence-weighted by status and age — 83% retained</div>
          <div style={{ fontSize:11, color:C.textSub, marginBottom:5 }}>Expected revenue from jobs in flight</div>
          <div style={{ width:'100%', height:36, background:'#e8eaed', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
            <div style={{ width:'83%', height:'100%', background:C.green, display:'flex', alignItems:'center', paddingLeft:10 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#fff', whiteSpace:'nowrap' }}>{fmtCurrency(d.totalFlightWeighted)} weighted</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <Badge type="green">Ready to invoice {fmtCurrency(d.rtiValue)} · 90%</Badge>
            <Badge type="blue">In-progress + Approved {fmtCurrency(d.backlogFace)} · 83%</Badge>
            <Badge type="gray">Skyline ~$40K</Badge>
          </div>
          <Insight>Ready to invoice = work done, 90% confidence. Approved/In-progress discounted by status age. See Jobs in flight page.</Insight>
        </Card>
      </Grid>

      <div style={{ background:'#fff', border:`2px solid ${C.green}`, borderRadius:12, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, margin:'10px 0 14px' }}>
        <div>
          <div style={{ fontSize:12, color:C.textSub, marginBottom:2 }}>Combined forward visibility</div>
          <div style={{ fontSize:11, color:C.textMuted }}>Pipeline {fmtCurrency(d.pipelineWeighted)} + Jobs in flight {fmtCurrency(d.totalFlightWeighted)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'baseline', gap:16 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>Face value</div>
            <div style={{ fontSize:18, fontWeight:600, color:C.textSub }}>{fmtCurrency(d.totalForwardFace)}</div>
          </div>
          <div style={{ fontSize:20, color:C.textMuted }}>→</div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>Weighted (realistic)</div>
            <div style={{ fontSize:28, fontWeight:700, color:C.green }}>{fmtCurrency(d.totalForwardWeighted)}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>Of $3M target</div>
            <div style={{ fontSize:18, fontWeight:600, color:C.amber }}>{fmtPct(d.totalForwardWeighted/3000000)}</div>
          </div>
        </div>
      </div>

      <SectionLabel>Customer concentration — revenue share · pipeline share · trend</SectionLabel>
      <Card style={{ marginBottom:14 }}>
        <Insight style={{ marginBottom:10, marginTop:0 }}>Healthy direction: INSTALL Net % declining while absolute revenue grows. Target below 35% by end of Year 2.</Insight>
        <div style={{ display:'grid', gridTemplateColumns:'160px 80px 70px 70px 70px 60px', fontSize:11, fontWeight:600, color:C.textMuted, padding:'0 0 6px', borderBottom:`0.5px solid ${C.border}`, gap:6, marginBottom:4 }}>
          <span>Customer</span><span>Yr1 revenue</span><span>Yr1 %</span><span>Yr2 % (so far)</span><span>Pipeline %</span><span>Trend</span>
        </div>
        {d.concentration.map((c,i) => {
          const y1Over = c.y1Pct > 0.2;
          const improving = c.y2Pct < c.y1Pct - 0.02;
          const worsening = c.y2Pct > c.y1Pct + 0.02;
          return (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'160px 80px 70px 70px 70px 60px', fontSize:11, padding:'5px 0', borderBottom:`0.5px solid ${C.border}`, gap:6, alignItems:'center' }}>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.text }}>{c.customer}</span>
              <span style={{ color:C.text }}>{fmtCurrency(c.y1Rev)}</span>
              <span><Badge type={y1Over?'red':'gray'}>{fmtPct(c.y1Pct)}</Badge></span>
              <span style={{ color:improving?C.green:worsening?C.red:C.textSub }}>{c.y2Pct>0?fmtPct(c.y2Pct):'—'}</span>
              <span style={{ color:C.textSub }}>{fmtPct(c.pipePct)}</span>
              <span style={{ fontWeight:700, fontSize:14, color:improving?C.green:worsening?C.red:C.textMuted }}>{improving?'↓ ✓':worsening?'↑ ⚠':'—'}</span>
            </div>
          );
        })}
        <div style={{ fontSize:10, color:C.textMuted, marginTop:6 }}>↓ ✓ = concentration decreasing (good) · ↑ ⚠ = concentration increasing</div>
      </Card>

      <SectionLabel>Year 1 monthly revenue — reference baseline</SectionLabel>
      <Card>
        <div style={{ height:150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.monthly} margin={{ top:5, right:10, bottom:5, left:10 }}>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`$${Math.round(v/1000)}K`} />
              <Tooltip formatter={v=>[fmtCurrency(v,false),'Revenue']} contentStyle={{ fontSize:12, borderRadius:8 }} />
              <Bar dataKey="revenue" radius={[3,3,0,0]}>
                {d.monthly.map((_,i)=><Cell key={i} fill={C.blue}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Insight>Year 1: {fmtCurrency(d.yr1Rev)}. Spikes from large INET jobs. Non-INET base avg ~$90K/mo. Mar low = year-end invoices not yet collected.</Insight>
      </Card>
    </div>
  );
}
