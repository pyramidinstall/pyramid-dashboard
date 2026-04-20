import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardTitle, SectionLabel, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { usePipelineData } from '../utils/dataHooks';
import { fmtCurrency, parseNum } from '../utils/sheets';

export default function Pipeline({ data }) {
  const d = usePipelineData(data);
  const [cohortFilter, setCohortFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [inetSelected, setInetSelected] = useState(null);
  if (!d) return null;

  const filteredOpen = cohortFilter ? d.allOpen.filter(r => r.cohort===cohortFilter) : d.allOpen;

  return (
    <div style={{padding:'20px 24px', maxWidth:1320, margin:'0 auto'}}>
      <h2 style={{fontSize:18, fontWeight:700, color:C.text, marginBottom:4}}>Pipeline</h2>
      <p style={{fontSize:12, color:C.textSub, marginBottom:12}}>
        Total: {fmtCurrency(d.totalFace + d.inetFace)} face · {fmtCurrency(d.totalWeighted + d.inetWeighted)} weighted &nbsp;|&nbsp;
        Non-INET: {d.allOpen.length} quotes · {fmtCurrency(d.totalFace)} &nbsp;|&nbsp;
        INET: {d.inetOpen.length} projects · {fmtCurrency(d.inetFace)}
      </p>

      <Alert type="amber">
        Total pipeline {fmtCurrency(d.totalFace + d.inetFace)} face → {fmtCurrency(d.totalWeighted + d.inetWeighted)} weighted.
        Non-INET discount driven by Maffucci (3.8% CR) and AFD (16% CR). INET weighted at 77.8% SP close rate.
      </Alert>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
        <div style={{background:'#f0f2f5', borderRadius:8, padding:'12px 14px'}}>
          <div style={{fontSize:11, color:C.textSub, marginBottom:3}}>Non-INET open quotes ({d.allOpen.length})</div>
          <div style={{fontSize:20, fontWeight:600, color:C.blue}}>{fmtCurrency(d.totalFace)} face</div>
          <div style={{fontSize:12, color:C.textMuted}}>→ {fmtCurrency(d.totalWeighted)} weighted · click bars to drill down</div>
        </div>
        <div style={{background:'#f0f2f5', borderRadius:8, padding:'12px 14px'}}>
          <div style={{fontSize:11, color:C.textSub, marginBottom:3}}>INSTALL Net open pipeline ({d.inetOpen.length} projects)</div>
          <div style={{fontSize:20, fontWeight:600, color:C.purple}}>{fmtCurrency(d.inetFace)} face</div>
          <div style={{fontSize:12, color:C.textMuted}}>→ {fmtCurrency(d.inetWeighted)} weighted at 77.8% SP close rate</div>
        </div>
      </div>

      <SectionLabel>Non-INET by cohort — face vs weighted · click bar to filter</SectionLabel>
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
            Clear: {cohortFilter} ×
          </button>
        )}
      </Card>

      {(d.expiryAlerts.length>0 || d.recentlyExpired.length>0) && <>
        <SectionLabel>Quote expiry alerts — L+ quotes ($15K+)</SectionLabel>
        <Alert type="red">
          {d.recentlyExpired.length>0 && <strong>{fmtCurrency(d.recentlyExpired.reduce((s,r)=>s+r.gt,0))} in recently expired L+ quotes need follow-up. </strong>}
          Check expiring quotes and follow up before they lapse.
        </Alert>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <Card>
            <CardTitle>Expiring within 30 days</CardTitle>
            <Table cols={[
              {key:'order_number',label:'#',width:'10%'},
              {key:'customer',label:'Customer',width:'28%'},
              {key:'gt',label:'Value',width:'16%',render:v=>fmtCurrency(v)},
              {key:'pm',label:'PM',width:'24%'},
              {key:'daysToExpiry',label:'Days left',width:'22%',render:v=><Badge type={v<=14?'red':'amber'}>{v}d</Badge>},
            ]} rows={d.expiryAlerts} onRowClick={setSelected}/>
          </Card>
          <Card>
            <CardTitle>Recently expired — follow up or reissue</CardTitle>
            <Table cols={[
              {key:'order_number',label:'#',width:'10%'},
              {key:'customer',label:'Customer',width:'28%'},
              {key:'gt',label:'Value',width:'16%',render:v=>fmtCurrency(v)},
              {key:'pm',label:'PM',width:'24%'},
              {key:'daysToExpiry',label:'Expired',width:'22%',render:v=><Badge type="amber">{Math.abs(v)}d ago</Badge>},
            ]} rows={d.recentlyExpired} onRowClick={setSelected}/>
          </Card>
        </div>
      </>}

      <SectionLabel>Large job nurture — $25K+ non-INET open quotes</SectionLabel>
      <Card style={{marginBottom:12}}>
        <Table cols={[
          {key:'order_number',label:'#',width:'8%'},
          {key:'order_name',label:'Order name',width:'22%',render:(v,r)=>v||r.customer},
          {key:'customer',label:'Customer',width:'18%'},
          {key:'pm',label:'PM',width:'14%'},
          {key:'gt',label:'Face',width:'10%',render:v=>fmtCurrency(v)},
          {key:'pipelineCR',label:'Win rate',width:'9%',render:v=>v?`${Math.round(v*100)}%`:'—'},
          {key:'pipelineWeighted',label:'Weighted',width:'10%',render:v=>{
            const n=v||0; return <span style={{color:n>20000?C.green:n>8000?C.amberTxt:C.red}}>{fmtCurrency(n)}</span>;
          }},
          {key:'daysPresented',label:'Age',width:'9%',render:v=>v?`${v}d`:'—'},
        ]} rows={d.nurture} onRowClick={setSelected}/>
      </Card>

      <SectionLabel>INSTALL Net open pipeline — {d.inetOpen.length} undecided projects · {fmtCurrency(d.inetFace)} face · {fmtCurrency(d.inetWeighted)} weighted</SectionLabel>
      <Card style={{marginBottom:12}}>
        <Table cols={[
          {key:'project_id',label:'Project ID',width:'11%'},
          {key:'project_name',label:'Project name',width:'30%'},
          {key:'pm',label:'PM',width:'18%'},
          {key:'price',label:'Face value',width:'14%',render:v=>fmtCurrency(v)},
          {key:'sp_bid_status',label:'Status',width:'13%',render:v=><Badge type="blue">{v}</Badge>},
          {key:'date_requested',label:'Requested',width:'14%'},
        ]} rows={[...d.inetOpen].sort((a,b)=>b.price-a.price)} onRowClick={setInetSelected}/>
      </Card>

      <SectionLabel>All non-INET open quotes{cohortFilter?` — ${cohortFilter}`:''} ({filteredOpen.length})</SectionLabel>
      <Card>
        <Table cols={[
          {key:'order_number',label:'#',width:'8%'},
          {key:'order_name',label:'Order name',width:'22%',render:(v,r)=>v||'—'},
          {key:'customer',label:'Customer',width:'22%'},
          {key:'pm',label:'PM',width:'16%'},
          {key:'gt',label:'Face',width:'10%',render:v=>fmtCurrency(v)},
          {key:'pipelineWeighted',label:'Weighted',width:'10%',render:v=>fmtCurrency(v||0)},
          {key:'daysToExpiry',label:'Expires',width:'12%',render:v=>{
            if(v===null||v===undefined)return'—';
            if(v<0)return<Badge type="gray">expired</Badge>;
            if(v<=14)return<Badge type="red">{v}d</Badge>;
            if(v<=30)return<Badge type="amber">{v}d</Badge>;
            return`${v}d`;
          }},
        ]} rows={filteredOpen} onRowClick={setSelected}/>
      </Card>

      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={()=>setSelected(null)}>
          {[['Order name',selected.order_name||'—'],['Customer',selected.customer],
            ['PM',selected.pm],['Status',selected.status],
            ['Face value',fmtCurrency(selected.gt)],['Cohort',selected.cohort],
            ['Win rate',selected.pipelineCR?`${Math.round(selected.pipelineCR*100)}%`:'—'],
            ['Weighted value',fmtCurrency(selected.pipelineWeighted||0)],
            ['Presented',selected.lqp_start_date||'—'],
            ['Days presented',selected.daysPresented?`${selected.daysPresented} days`:'—'],
            ['Expires',selected.expiry_date||'—'],
            ['Days to expiry',selected.daysToExpiry!==null?`${selected.daysToExpiry} days`:'—'],
          ].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}

      {inetSelected && (
        <Modal title={`INET Project #${inetSelected.project_id}`} onClose={()=>setInetSelected(null)}>
          {[['Project name',inetSelected.project_name||'—'],['PM',inetSelected.pm],
            ['Face value',fmtCurrency(inetSelected.price)],
            ['Weighted (77.8%)',fmtCurrency(Math.round(inetSelected.price*0.778))],
            ['Status',inetSelected.sp_bid_status],['Project status',inetSelected.proj_status],
            ['Date requested',inetSelected.date_requested||'—'],
            ['Location',`${inetSelected.city||''} ${inetSelected.state||''}`.trim()||'—'],
          ].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}
    </div>
  );
}
