import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardTitle, SectionLabel, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { parseNum, parseBool, fmtCurrency } from '../utils/sheets';

const isTrue = v => v===true||String(v).toUpperCase()==='TRUE';

function buildPipelineData(data) {
  if (!data) return null;
  const { orders, installnet } = data;

  // Non-INET open quotes
  const open = orders.filter(r => isTrue(r.is_open_quote));

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

  const nonInetFace = open.reduce((s,r) => s+parseNum(r.grand_total),0);
  const nonInetWeighted = open.reduce((s,r) => s+parseNum(r.pipeline_weighted||0),0);

  // INET open pipeline from PYR200
  const inetOpen = (installnet||[]).filter(r =>
    ['Final Quote','Project','Estimate'].includes(r.sp_bid_status));
  const inetFace = inetOpen.reduce((s,r) => s+parseNum(r.installation_price||0),0);
  const inetWeighted = Math.round(inetFace * 0.778);

  const totalFace = nonInetFace + inetFace;
  const totalWeighted = nonInetWeighted + inetWeighted;

  return {
    byCohort, expiryAlerts, recentlyExpired, nurture, allOpen: open,
    nonInetFace: Math.round(nonInetFace), nonInetWeighted: Math.round(nonInetWeighted),
    inetOpen, inetFace: Math.round(inetFace), inetWeighted,
    totalFace: Math.round(totalFace), totalWeighted: Math.round(totalWeighted),
  };
}

export default function Pipeline({ data }) {
  const d = buildPipelineData(data);
  const [cohortFilter, setCohortFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [inetSelected, setInetSelected] = useState(null);

  if (!d) return null;

  const filteredOpen = cohortFilter ? d.allOpen.filter(r=>r.cohort===cohortFilter) : d.allOpen;

  return (
    <div style={{padding:'20px 24px', maxWidth:1320, margin:'0 auto'}}>
      <h2 style={{fontSize:18, fontWeight:700, color:C.text, marginBottom:4}}>Pipeline</h2>
      <p style={{fontSize:12, color:C.textSub, marginBottom:12}}>
        Total: {fmtCurrency(d.totalFace)} face · {fmtCurrency(d.totalWeighted)} weighted &nbsp;|&nbsp;
        Non-INET: {d.allOpen.length} quotes · {fmtCurrency(d.nonInetFace)} face &nbsp;|&nbsp;
        INET: {d.inetOpen.length} open projects · {fmtCurrency(d.inetFace)} face
      </p>

      <Alert type="amber">
        Total pipeline {fmtCurrency(d.totalFace)} face → {fmtCurrency(d.totalWeighted)} weighted.
        Non-INET discount driven by Maffucci (3.8% CR) and AFD (16% CR).
        INET weighted at 77.8% SP close rate from Year 1 actuals.
      </Alert>

      {/* Summary metrics */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
        <div style={{background:'#f0f2f5', borderRadius:8, padding:'12px 14px'}}>
          <div style={{fontSize:11, color:C.textSub, marginBottom:3}}>Non-INET open quotes ({d.allOpen.length})</div>
          <div style={{fontSize:20, fontWeight:600, color:C.blue}}>{fmtCurrency(d.nonInetFace)} face</div>
          <div style={{fontSize:12, color:C.textMuted}}>→ {fmtCurrency(d.nonInetWeighted)} weighted · click bars below to drill down</div>
        </div>
        <div style={{background:'#f0f2f5', borderRadius:8, padding:'12px 14px'}}>
          <div style={{fontSize:11, color:C.textSub, marginBottom:3}}>INSTALL Net open pipeline ({d.inetOpen.length} projects)</div>
          <div style={{fontSize:20, fontWeight:600, color:C.purple}}>{fmtCurrency(d.inetFace)} face</div>
          <div style={{fontSize:12, color:C.textMuted}}>→ {fmtCurrency(d.inetWeighted)} weighted at 77.8% SP close rate</div>
        </div>
      </div>

      {/* Non-INET cohort chart */}
      <SectionLabel>Non-INET by cohort — face vs weighted · click bar to filter quotes below</SectionLabel>
      <Card style={{marginBottom:12}}>
        <div style={{height:190}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.byCohort} margin={{top:5,right:10,bottom:5,left:10}}>
              <XAxis dataKey="cohort" tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} tickFormatter={v=>`$${Math.round(v/1000)}K`}/>
              <Tooltip formatter={v=>[fmtCurrency(v,false),'']} contentStyle={{fontSize:12,borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Bar dataKey="face" name="Face value" fill={C.blue} radius={[3,3,0,0]} opacity={0.4}
                onClick={e=>setCohortFilter(cohortFilter===e.cohort?null:e.cohort)} style={{cursor:'pointer'}}/>
              <Bar dataKey="weighted" name="Weighted" fill={C.green} radius={[3,3,0,0]}
                onClick={e=>setCohortFilter(cohortFilter===e.cohort?null:e.cohort)} style={{cursor:'pointer'}}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {cohortFilter && (
          <button onClick={()=>setCohortFilter(null)} style={{marginTop:6,background:'transparent',border:`1px solid ${C.border}`,color:C.textSub,padding:'3px 10px',borderRadius:4,fontSize:11,cursor:'pointer'}}>
            Clear filter: {cohortFilter} ×
          </button>
        )}
      </Card>

      {/* Expiry alerts */}
      {(d.expiryAlerts.length>0 || d.recentlyExpired.length>0) && <>
        <SectionLabel>Quote expiry alerts — L+ quotes ($15K+)</SectionLabel>
        <Alert type="red">
          {d.recentlyExpired.length>0 && <strong>{fmtCurrency(d.recentlyExpired.reduce((s,r)=>s+parseNum(r.grand_total),0))} in recently expired L+ quotes need follow-up. </strong>}
          Check expiring quotes and follow up before they lapse.
        </Alert>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <Card>
            <CardTitle>Expiring within 30 days</CardTitle>
            <Table cols={[
              {key:'order_number',label:'#',width:'10%'},
              {key:'customer',label:'Customer',width:'30%'},
              {key:'grand_total',label:'Value',width:'16%',render:v=>fmtCurrency(parseNum(v))},
              {key:'pm',label:'PM',width:'22%'},
              {key:'days_to_expiry',label:'Days left',width:'22%',render:v=><Badge type={parseNum(v)<=14?'red':'amber'}>{v}d</Badge>},
            ]} rows={d.expiryAlerts} onRowClick={setSelected}/>
          </Card>
          <Card>
            <CardTitle>Recently expired — follow up or reissue</CardTitle>
            <Table cols={[
              {key:'order_number',label:'#',width:'10%'},
              {key:'customer',label:'Customer',width:'30%'},
              {key:'grand_total',label:'Value',width:'16%',render:v=>fmtCurrency(parseNum(v))},
              {key:'pm',label:'PM',width:'22%'},
              {key:'days_to_expiry',label:'Expired',width:'22%',render:v=><Badge type="amber">{Math.abs(parseNum(v))}d ago</Badge>},
            ]} rows={d.recentlyExpired} onRowClick={setSelected}/>
          </Card>
        </div>
      </>}

      {/* Large job nurture */}
      <SectionLabel>Large job nurture — $25K+ non-INET open quotes</SectionLabel>
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
        ]} rows={d.nurture} onRowClick={setSelected}/>
      </Card>

      {/* INET open pipeline */}
      <SectionLabel>INSTALL Net open pipeline — {d.inetOpen.length} undecided projects · {fmtCurrency(d.inetFace)} face · {fmtCurrency(d.inetWeighted)} weighted</SectionLabel>
      <Card style={{marginBottom:12}}>
        <Table cols={[
          {key:'project_id',label:'Project ID',width:'11%'},
          {key:'project_name',label:'Project name',width:'28%'},
          {key:'pm',label:'PM',width:'18%'},
          {key:'installation_price',label:'Face value',width:'13%',render:v=>fmtCurrency(parseNum(v))},
          {key:'sp_bid_status',label:'Status',width:'13%',render:v=><Badge type="blue">{v}</Badge>},
          {key:'date_requested',label:'Requested',width:'17%'},
        ]} rows={d.inetOpen.sort((a,b)=>parseNum(b.installation_price)-parseNum(a.installation_price))}
        onRowClick={setInetSelected}/>
      </Card>

      {/* All non-INET open quotes */}
      <SectionLabel>All non-INET open quotes{cohortFilter?` — ${cohortFilter}`:''} ({filteredOpen.length})</SectionLabel>
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
        ]} rows={filteredOpen} onRowClick={setSelected}/>
      </Card>

      {/* Non-INET quote modal */}
      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={()=>setSelected(null)}>
          {[['Order name',selected.order_name||'—'],['Customer',selected.customer],
            ['PM',selected.pm],['Status',selected.status],
            ['Face value',fmtCurrency(parseNum(selected.grand_total),false)],
            ['Cohort',selected.cohort],
            ['Win rate used',selected.pipeline_cr?`${Math.round(parseNum(selected.pipeline_cr)*100)}%`:'—'],
            ['Weighted value',fmtCurrency(parseNum(selected.pipeline_weighted||0),false)],
            ['Presented',selected.lqp_start_date||'—'],
            ['Days presented',selected.days_presented?`${selected.days_presented} days`:'—'],
            ['Expires',selected.expiry_date||'—'],
          ].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}

      {/* INET project modal */}
      {inetSelected && (
        <Modal title={`INET Project #${inetSelected.project_id}`} onClose={()=>setInetSelected(null)}>
          {[['Project name',inetSelected.project_name||'—'],['PM',inetSelected.pm],
            ['Face value',fmtCurrency(parseNum(inetSelected.installation_price),false)],
            ['Weighted (77.8%)',fmtCurrency(parseNum(inetSelected.installation_price)*0.778,false)],
            ['Status',inetSelected.sp_bid_status],['Project status',inetSelected.proj_status],
            ['Date requested',inetSelected.date_requested||'—'],
            ['Location',`${inetSelected.city||''} ${inetSelected.state||''}`.trim()||'—'],
          ].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}
    </div>
  );
}
