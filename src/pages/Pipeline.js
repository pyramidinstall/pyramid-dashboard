import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardTitle, SectionLabel, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { usePipelineData } from '../utils/dataHooks';
import { fmtCurrency, parseNum } from '../utils/sheets';

const COHORT_COLORS = {'XS <$1K':C.purple,'S $1K-5K':C.blue,'M $5K-15K':C.green,'L $15K-50K':C.amber,'XL $50K+':C.red};

export function usePipelineDataFixed(data) {
  if (!data) return null;
  const { orders } = data;
  const open = orders.filter(r => r.is_open_quote === 'TRUE');
  const cohorts = ['XS <$1K','S $1K-5K','M $5K-15K','L $15K-50K','XL $50K+'];
  const byCohort = cohorts.map(c => {
    const rows = open.filter(r => r.cohort === c);
    return {
      cohort: c, count: rows.length,
      face: Math.round(rows.reduce((s,r) => s+parseNum(r.grand_total),0)),
      weighted: Math.round(rows.reduce((s,r) => s+parseNum(r.pipeline_weighted||0),0)),
    };
  });
  const expiryAlerts = orders.filter(r => r.expiry_alert)
    .sort((a,b) => parseNum(a.days_to_expiry)-parseNum(b.days_to_expiry));
  const recentlyExpired = orders
    .filter(r => r.status==='Labor Quote Expired' && parseNum(r.grand_total)>=15000)
    .filter(r => { const d=parseNum(r.days_to_expiry); return d<0&&d>-90; })
    .sort((a,b) => parseNum(b.days_to_expiry)-parseNum(a.days_to_expiry));
  const nurture = open.filter(r => parseNum(r.grand_total)>=25000)
    .sort((a,b) => parseNum(b.grand_total)-parseNum(a.grand_total));
  const totalFace = open.reduce((s,r) => s+parseNum(r.grand_total),0);
  const totalWeighted = open.reduce((s,r) => s+parseNum(r.pipeline_weighted||0),0);
  return {byCohort, expiryAlerts, recentlyExpired, nurture, allOpen:open, totalFace, totalWeighted};
}

export default function Pipeline({ data }) {
  const d = usePipelineDataFixed(data);
  const [cohortFilter, setCohortFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  if (!d) return null;

  const filteredOpen = cohortFilter ? d.allOpen.filter(r=>r.cohort===cohortFilter) : d.allOpen;
  const chartData = d.byCohort.map(c=>({name:c.cohort, cohort:c.cohort, face:c.face, weighted:c.weighted}));

  return (
    <div style={{padding:'20px 24px', maxWidth:1320, margin:'0 auto'}}>
      <h2 style={{fontSize:18, fontWeight:700, color:C.text, marginBottom:4}}>Pipeline</h2>
      <p style={{fontSize:12, color:C.textSub, marginBottom:12}}>
        Non-INET: {d.allOpen.length} quotes · {fmtCurrency(d.totalFace)} face · {fmtCurrency(d.totalWeighted)} weighted
        &nbsp;·&nbsp;
        INET (PYR200): {(d.inetOpen||[]).length} projects · {fmtCurrency(d.inetPipelineFace)} face · {fmtCurrency(d.inetPipelineWeighted)} weighted
      </p>

      <Alert type="amber">
        Non-INET: {fmtCurrency(d.totalFace)} face → {fmtCurrency(d.totalWeighted)} weighted ({d.totalFace>0?Math.round((1-d.totalWeighted/d.totalFace)*100):0}% discount — Maffucci and AFD drive most of the gap).
        &nbsp;INET (PYR200): {fmtCurrency(d.inetPipelineFace)} face → {fmtCurrency(d.inetPipelineWeighted)} weighted (77.8% SP close rate).
      </Alert>

      <SectionLabel>By cohort — face vs weighted · click bar to filter quotes below</SectionLabel>
      <Card style={{marginBottom:12}}>
        <div style={{height:190}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{top:5,right:10,bottom:5,left:10}}>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} tickFormatter={v=>`$${Math.round(v/1000)}K`} />
              <Tooltip formatter={v=>[fmtCurrency(v,false),'']} contentStyle={{fontSize:12,borderRadius:8}} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar dataKey="face" name="Face value" fill={C.blue} radius={[3,3,0,0]} opacity={0.4}
                onClick={e=>setCohortFilter(cohortFilter===e.cohort?null:e.cohort)} style={{cursor:'pointer'}} />
              <Bar dataKey="weighted" name="Weighted" fill={C.green} radius={[3,3,0,0]}
                onClick={e=>setCohortFilter(cohortFilter===e.cohort?null:e.cohort)} style={{cursor:'pointer'}} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {cohortFilter && (
          <button onClick={()=>setCohortFilter(null)} style={{marginTop:6,background:'transparent',border:`1px solid ${C.border}`,color:C.textSub,padding:'3px 10px',borderRadius:4,fontSize:11,cursor:'pointer'}}>
            Clear filter: {cohortFilter} ×
          </button>
        )}
      </Card>

      {(d.expiryAlerts.length>0 || d.recentlyExpired.length>0) && <>
        <SectionLabel>Quote expiry alerts — L+ quotes ($15K+)</SectionLabel>
        <Alert type="red"><strong>{d.recentlyExpired.reduce((s,r)=>s+parseNum(r.grand_total),0)>0 ? fmtCurrency(d.recentlyExpired.reduce((s,r)=>s+parseNum(r.grand_total),0))+' in recently expired L+ quotes need follow-up.' : ''}</strong> Check expiring quotes and follow up before they lapse.</Alert>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <Card>
            <CardTitle>Expiring within 30 days — follow up now</CardTitle>
            <Table cols={[
              {key:'order_number',label:'#',width:'10%'},
              {key:'customer',label:'Customer',width:'32%'},
              {key:'grand_total',label:'Value',width:'16%',render:v=>fmtCurrency(parseNum(v))},
              {key:'pm',label:'PM',width:'22%'},
              {key:'days_to_expiry',label:'Days left',width:'20%',render:v=><Badge type={parseNum(v)<=14?'red':'amber'}>{v}d</Badge>},
            ]} rows={d.expiryAlerts} onRowClick={setSelected} />
          </Card>
          <Card>
            <CardTitle>Recently expired — follow up or reissue</CardTitle>
            <Table cols={[
              {key:'order_number',label:'#',width:'10%'},
              {key:'customer',label:'Customer',width:'32%'},
              {key:'grand_total',label:'Value',width:'16%',render:v=>fmtCurrency(parseNum(v))},
              {key:'pm',label:'PM',width:'22%'},
              {key:'days_to_expiry',label:'Expired',width:'20%',render:v=><Badge type="amber">{Math.abs(parseNum(v))}d ago</Badge>},
            ]} rows={d.recentlyExpired} onRowClick={setSelected} />
          </Card>
        </div>
      </>}

      <SectionLabel>Large job nurture — $25K+ open quotes</SectionLabel>
      <Card style={{marginBottom:12}}>
        <Table cols={[
          {key:'order_number',label:'#',width:'8%'},
          {key:'order_name',label:'Order name',width:'22%',render:(v,row)=>v||row.customer},
          {key:'customer',label:'Customer',width:'18%'},
          {key:'pm',label:'PM',width:'14%'},
          {key:'grand_total',label:'Face',width:'10%',render:v=>fmtCurrency(parseNum(v))},
          {key:'pipeline_cr',label:'Win rate',width:'9%',render:v=>v?`${Math.round(parseNum(v)*100)}%`:'—'},
          {key:'pipeline_weighted',label:'Weighted',width:'10%',render:v=>{
            const n=parseNum(v);
            return <span style={{color:n>20000?C.green:n>8000?C.amberTxt:C.red}}>{fmtCurrency(n)}</span>;
          }},
          {key:'days_presented',label:'Age',width:'9%',render:v=>v?`${v}d`:'—'},
        ]} rows={d.nurture} onRowClick={setSelected} />
      </Card>

      <SectionLabel>All open quotes{cohortFilter?` — ${cohortFilter}`:''} ({filteredOpen.length} non-INET · {(d.inetOpen||[]).length} INET)</SectionLabel>
      <Card>
        <Table cols={[
          {key:'order_number',label:'#',width:'8%'},
          {key:'order_name',label:'Order name',width:'22%',render:(v,row)=>v||'—'},
          {key:'customer',label:'Customer',width:'22%'},
          {key:'pm',label:'PM',width:'16%'},
          {key:'grand_total',label:'Face',width:'11%',render:v=>fmtCurrency(parseNum(v))},
          {key:'pipeline_weighted',label:'Weighted',width:'11%',render:v=>fmtCurrency(parseNum(v))},
          {key:'days_to_expiry',label:'Expires',width:'10%',render:v=>{
            if(!v)return'—'; const n=parseNum(v);
            if(n<0)return<Badge type="gray">expired</Badge>;
            if(n<=14)return<Badge type="red">{n}d</Badge>;
            if(n<=30)return<Badge type="amber">{n}d</Badge>;
            return`${n}d`;
          }},
        ]} rows={filteredOpen} onRowClick={setSelected} />
      </Card>

      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={()=>setSelected(null)}>
          {[
            ['Order name', selected.order_name||'—'],
            ['Customer', selected.customer],
            ['PM / Contact', selected.pm],
            ['Salesperson', selected.salesperson],
            ['Status', selected.status],
            ['Face value', fmtCurrency(parseNum(selected.grand_total),false)],
            ['Cohort', selected.cohort],
            ['Win rate used', selected.pipeline_cr?`${Math.round(parseNum(selected.pipeline_cr)*100)}%`:'—'],
            ['Weighted value', fmtCurrency(parseNum(selected.pipeline_weighted||0),false)],
            ['Presented', selected.lqp_start_date||'—'],
            ['Days presented', selected.days_presented?`${selected.days_presented} days`:'—'],
            ['Expires', selected.expiry_date||'—'],
            ['Days to expiry', selected.days_to_expiry?`${selected.days_to_expiry} days`:'—'],
          ].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}
    </div>
  );
}
