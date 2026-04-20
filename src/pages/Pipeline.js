import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardTitle, SectionLabel, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { usePipelineData } from '../utils/dataHooks';
import { fmtCurrency, parseNum } from '../utils/sheets';

const COHORT_COLORS = { 'XS <$1K':C.purple,'S $1K-5K':C.blue,'M $5K-15K':C.green,'L $15K-50K':C.amber,'XL $50K+':C.red };

export default function Pipeline({ data }) {
  const d = usePipelineData(data);
  const [cohortFilter, setCohortFilter] = useState(null);
  const [selected, setSelected] = useState(null);

  if (!d) return null;

  const totalFace = d.allOpen.reduce((s,r)=>s+parseNum(r.grand_total),0);
  const totalWeighted = d.allOpen.reduce((s,r)=>s+parseNum(r.weighted_backlog||0),0);
  const filteredOpen = cohortFilter ? d.allOpen.filter(r=>r.cohort===cohortFilter) : d.allOpen;

  const chartData = d.byCohort.map(c=>({ name:c.cohort.split(' ')[0]+c.cohort.split(' ')[1], face:c.face, weighted:c.weighted }));

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>Pipeline</h2>
      <p style={{ fontSize:12, color:C.textSub, marginBottom:12 }}>{d.allOpen.length} open quotes · {fmtCurrency(totalFace)} face · {fmtCurrency(totalWeighted)} weighted · click any bar or row to drill down</p>

      <Alert type="amber">Face value ({fmtCurrency(totalFace)}) vs weighted ({fmtCurrency(totalWeighted)}) — 61% discount. Maffucci $228K face → $9K weighted (no history, 3.8% cohort CR). AFD $200K → $32K (16% CR). Plan from weighted only.</Alert>

      <SectionLabel>By cohort — face vs weighted · click bar to filter quotes below</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <div style={{ height:190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top:5, right:10, bottom:5, left:10 }}>
              <XAxis dataKey="name" tick={{ fontSize:10, fill:C.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`$${Math.round(v/1000)}K`} />
              <Tooltip formatter={v=>[fmtCurrency(v,false),'']} contentStyle={{ fontSize:12, borderRadius:8 }} />
              <Bar dataKey="face" name="Face value" fill={C.blue} radius={[3,3,0,0]} opacity={0.4}
                onClick={(e)=>{ const c=d.byCohort.find(x=>x.cohort.startsWith(e.name.slice(0,2))||x.cohort===e.name); if(c) setCohortFilter(cohortFilter===c.cohort?null:c.cohort); }} style={{ cursor:'pointer' }} />
              <Bar dataKey="weighted" name="Weighted" fill={C.green} radius={[3,3,0,0]}
                onClick={(e)=>{ const c=d.byCohort.find(x=>x.cohort.startsWith(e.name.slice(0,2))||x.cohort===e.name); if(c) setCohortFilter(cohortFilter===c.cohort?null:c.cohort); }} style={{ cursor:'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display:'flex', gap:12, marginTop:6, fontSize:11, color:C.textSub }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:C.blue, opacity:0.4, display:'inline-block' }}></span>Face value</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:C.green, display:'inline-block' }}></span>Weighted</span>
          {cohortFilter && <button onClick={()=>setCohortFilter(null)} style={{ background:'transparent', border:`1px solid ${C.border}`, color:C.textSub, padding:'2px 8px', borderRadius:4, fontSize:11, cursor:'pointer' }}>Clear filter ×</button>}
        </div>
      </Card>

      {(d.expiryAlerts.length > 0 || d.recentlyExpired.length > 0) && <>
        <SectionLabel>Quote expiry alerts — L+ quotes ($15K+)</SectionLabel>
        <Alert type="red"><strong>{fmtCurrency(d.recentlyExpired.reduce((s,r)=>s+parseNum(r.grand_total),0))} in recently expired L+ quotes need follow-up.</strong> Whalen #12150 ($249.5K) confirmed Q1 2027. Systems Source #12236 ($78K) expired recently.</Alert>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <Card>
            <CardTitle>Expiring within 30 days</CardTitle>
            <Table cols={[
              { key:'order_number', label:'#', width:'12%' },
              { key:'customer', label:'Customer', width:'35%' },
              { key:'grand_total', label:'Value', width:'18%', render:v=>fmtCurrency(parseNum(v)) },
              { key:'days_to_expiry', label:'Days left', width:'18%', render:v=><Badge type={parseNum(v)<=14?'red':'amber'}>{v}d</Badge> },
            ]} rows={d.expiryAlerts} onRowClick={setSelected} />
          </Card>
          <Card>
            <CardTitle>Recently expired — follow up or reissue</CardTitle>
            <Table cols={[
              { key:'order_number', label:'#', width:'12%' },
              { key:'customer', label:'Customer', width:'35%' },
              { key:'grand_total', label:'Value', width:'18%', render:v=>fmtCurrency(parseNum(v)) },
              { key:'days_to_expiry', label:'Expired', width:'18%', render:v=><Badge type="amber">{Math.abs(parseNum(v))}d ago</Badge> },
            ]} rows={d.recentlyExpired} onRowClick={setSelected} />
          </Card>
        </div>
      </>}

      <SectionLabel>Large job nurture — $25K+ open quotes</SectionLabel>
      <Alert type="amber">{d.nurture.length} quotes · {fmtCurrency(d.nurture.reduce((s,r)=>s+parseNum(r.grand_total),0))} face · {fmtCurrency(d.nurture.reduce((s,r)=>s+parseNum(r.weighted_backlog||0),0))} weighted. XL jobs not in base projection — wins are upside. Click any row for detail.</Alert>
      <Card style={{ marginBottom:12 }}>
        <Table cols={[
          { key:'order_number', label:'#', width:'8%' },
          { key:'customer', label:'Customer', width:'20%' },
          { key:'pm', label:'PM', width:'15%' },
          { key:'grand_total', label:'Face', width:'10%', render:v=>fmtCurrency(parseNum(v)) },
          { key:'cohort', label:'Tier', width:'8%', render:v=><Badge type={v?.includes('XL')?'red':'amber'}>{v?.includes('XL')?'XL':'L'}</Badge> },
          { key:'backlog_confidence', label:'CR', width:'7%', render:v=>v?`${Math.round(parseNum(v)*100)}%`:'—' },
          { key:'weighted_backlog', label:'Weighted', width:'10%', render:v=>{const n=parseNum(v); return <span style={{color:n>20000?C.green:n>8000?C.amberTxt:C.red}}>{fmtCurrency(n)}</span>;} },
          { key:'days_presented', label:'Age', width:'7%', render:v=>v?`${v}d`:'—' },
          { key:'days_to_expiry', label:'Expires', width:'8%', render:v=>{if(!v)return'—'; const n=parseNum(v); if(n<0)return<Badge type="gray">expired</Badge>; if(n<=21)return<Badge type="red">{n}d</Badge>; if(n<=45)return<Badge type="amber">{n}d</Badge>; return`${n}d`;} },
          { key:'channel', label:'Ch.', width:'7%', render:v=><Badge type={v==='INSTALL Net'?'blue':'gray'}>{v==='INSTALL Net'?'INET':'IQ'}</Badge> },
        ]} rows={d.nurture} onRowClick={setSelected} />
      </Card>

      <SectionLabel>All open quotes{cohortFilter?` — ${cohortFilter}`:''} ({filteredOpen.length})</SectionLabel>
      <Card>
        <Table cols={[
          { key:'order_number', label:'#', width:'8%' },
          { key:'customer', label:'Customer', width:'22%' },
          { key:'pm', label:'PM', width:'16%' },
          { key:'channel', label:'Channel', width:'9%', render:v=><Badge type={v==='INSTALL Net'?'blue':'gray'}>{v==='INSTALL Net'?'INET':'IQ'}</Badge> },
          { key:'grand_total', label:'Face', width:'10%', render:v=>fmtCurrency(parseNum(v)) },
          { key:'cohort', label:'Cohort', width:'10%' },
          { key:'weighted_backlog', label:'Weighted', width:'10%', render:v=>fmtCurrency(parseNum(v)) },
          { key:'days_to_expiry', label:'Expires', width:'8%', render:v=>{if(!v)return'—'; const n=parseNum(v); if(n<=14)return<Badge type="red">{n}d</Badge>; if(n<=30)return<Badge type="amber">{n}d</Badge>; return`${n}d`;} },
        ]} rows={filteredOpen} onRowClick={setSelected} />
      </Card>

      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={()=>setSelected(null)}>
          {[['Customer',selected.customer],['PM / Contact',selected.pm],['Salesperson',selected.salesperson],['Status',selected.status],['Face value',fmtCurrency(parseNum(selected.grand_total),false)],['Cohort',selected.cohort],['Close rate used',selected.backlog_confidence?`${Math.round(parseNum(selected.backlog_confidence)*100)}%`:'—'],['Weighted value',fmtCurrency(parseNum(selected.weighted_backlog||0),false)],['Presented',selected.lqp_start_date||'—'],['Days presented',selected.days_presented?`${selected.days_presented} days`:'—'],['Expires',selected.expiry_date||'—'],['Days to expiry',selected.days_to_expiry?`${selected.days_to_expiry} days`:'—'],['Channel',selected.channel]].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}
    </div>
  );
}
