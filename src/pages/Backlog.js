import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { useJobsInFlightData } from '../utils/dataHooks';
import { fmtCurrency } from '../utils/sheets';

const TIER_COLORS = {'Ready to invoice':C.green,'On track':C.green,'Slight delay':C.amber,'Check in':C.red,'Follow up':C.red};
const TIER_BADGE  = {'Ready to invoice':'green','On track':'green','Slight delay':'amber','Check in':'red','Follow up':'red'};

function JobTable({ rows, setSelected, total, weighted }) {
  return <>
    <Table cols={[
      {key:'order_number',label:'#',width:'9%'},
      {key:'order_name',label:'Order name',width:'26%',render:(v,r)=>v||r.customer||'—'},
      {key:'customer',label:'Customer / PM',width:'22%',render:(_,r)=>(
        <span style={{fontSize:11}}>{r.customer}<br/>
          <span style={{color:C.textMuted,fontSize:10}}>{r.pm}</span>
        </span>
      )},
      {key:'value',label:'Remaining',width:'13%',render:v=>fmtCurrency(v||0)},
      {key:'daysInStatus',label:'Days',width:'8%',render:v=>v||'—'},
      {key:'backlogTier',label:'Confidence',width:'22%',render:v=>v?<Badge type={TIER_BADGE[v]||'gray'}>{v}</Badge>:'—'},
    ]} rows={rows} onRowClick={setSelected}/>
    {total > 0 && (
      <div style={{display:'flex',justifyContent:'flex-end',paddingTop:6,fontSize:11,fontWeight:600,color:C.text}}>
        Total: {fmtCurrency(total)} · Weighted: {fmtCurrency(weighted)}
      </div>
    )}
  </>;
}

export default function Backlog({ data }) {
  const d = useJobsInFlightData(data);
  const [selected, setSelected] = useState(null);
  if (!d) return null;

  const rtiOverdue = d.readyToInvoice.filter(r=>r.flag==='overdue');
  const pieData = [
    {name:'Ready to invoice', value:d.rtiTotal, color:C.green},
    {name:'On track', value:d.inProgress.filter(r=>r.backlogTier==='On track').reduce((s,r)=>s+r.value,0)+
      d.approved.filter(r=>r.backlogTier==='On track').reduce((s,r)=>s+r.value,0), color:'#5DCAA5'},
    {name:'Slight delay', value:d.inProgress.filter(r=>r.backlogTier==='Slight delay').reduce((s,r)=>s+r.value,0)+
      d.approved.filter(r=>r.backlogTier==='Slight delay').reduce((s,r)=>s+r.value,0), color:C.amber},
    {name:'Check in', value:d.checkinAlerts.reduce((s,r)=>s+r.value,0), color:C.red},
  ].filter(t=>t.value>0);

  return (
    <div style={{padding:'20px 24px', maxWidth:1320, margin:'0 auto'}}>
      <h2 style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>Jobs in flight</h2>
      <p style={{fontSize:12,color:C.textSub,marginBottom:12}}>Won jobs pending completion and invoicing · click any row for detail</p>

      {rtiOverdue.length>0 && (
        <Alert type="red"><strong>Ready to invoice:</strong> {rtiOverdue.length} order{rtiOverdue.length>1?'s':''} over 7 days old. Work is done — review and send invoice today.</Alert>
      )}

      <Grid cols={2} gap={10} style={{marginBottom:12}}>
        <Card>
          <CardTitle>By timing confidence — click slice to filter</CardTitle>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{height:160,width:160,flexShrink:0}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={v=>[fmtCurrency(v,false),'']} contentStyle={{fontSize:12,borderRadius:8}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{flex:1}}>
              {pieData.map(t=>(
                <div key={t.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <div style={{width:10,height:10,borderRadius:2,background:t.color,flexShrink:0}}/>
                  <span style={{fontSize:12,color:C.text,flex:1}}>{t.name}</span>
                  <span style={{fontSize:12,fontWeight:600,color:t.color}}>{fmtCurrency(t.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle>Check-in alerts — aging beyond expected timing</CardTitle>
          <Table cols={[
            {key:'order_number',label:'#',width:'12%'},
            {key:'order_name',label:'Order name',width:'30%',render:(v,r)=>v||r.customer||'—'},
            {key:'customer',label:'Customer',width:'26%'},
            {key:'value',label:'Value',width:'16%',render:v=>fmtCurrency(v||0)},
            {key:'daysInStatus',label:'Days',width:'16%',render:v=><Badge type={v>180?'red':'amber'}>{v}d</Badge>},
          ]} rows={d.checkinAlerts} onRowClick={setSelected}/>
        </Card>
      </Grid>

      <SectionLabel>Ready to invoice — work complete, your review pending</SectionLabel>
      <Card style={{marginBottom:12}}>
        <Table cols={[
          {key:'order_number',label:'#',width:'9%'},
          {key:'order_name',label:'Order name',width:'26%',render:(v,r)=>v||r.customer||'—'},
          {key:'customer',label:'Customer / PM',width:'22%',render:(_,r)=>(
            <span style={{fontSize:11}}>{r.customer}<br/><span style={{color:C.textMuted,fontSize:10}}>{r.pm}</span></span>
          )},
          {key:'value',label:'Value',width:'13%',render:v=>fmtCurrency(v||0)},
          {key:'daysInStatus',label:'Days',width:'8%'},
          {key:'flag',label:'Flag',width:'22%',render:v=>(
            <Badge type={v==='overdue'?'red':v==='exclude'?'gray':'green'}>
              {v==='overdue'?'overdue >7d':v==='exclude'?'exclude >30d':'new'}
            </Badge>
          )},
        ]} rows={d.readyToInvoice} onRowClick={setSelected}/>
        <div style={{display:'flex',justifyContent:'flex-end',paddingTop:6,fontSize:11,fontWeight:600,color:C.text}}>
          Total: {fmtCurrency(d.rtiTotal)} · 95% confidence = {fmtCurrency(d.rtiWeighted)}
        </div>
        <Insight>Target: zero orders over 7 days. Exclude from revenue weighting at 30 days. These turn over in 1–3 days normally.</Insight>
      </Card>

      <SectionLabel>In-progress — scheduled with real dates</SectionLabel>
      <Card style={{marginBottom:12}}>
        <JobTable rows={d.inProgress} setSelected={setSelected} total={d.ipTotal} weighted={d.ipWeighted}/>
        <Insight>Delays are out of your control once scheduled. Confirm status if aging significantly beyond expected duration.</Insight>
      </Card>

      <SectionLabel>Approved — PO or verbal received, awaiting scheduling</SectionLabel>
      <Card style={{marginBottom:12}}>
        <JobTable rows={d.approved} setSelected={setSelected} total={d.apTotal} weighted={d.apWeighted}/>
      </Card>

      <SectionLabel>Skyline Windows — T&M draw-down (separate)</SectionLabel>
      <Card style={{marginBottom:12}}>
        <Grid cols={3} gap={10}>
          {[['Estimated remaining','~$40K','~4 months at $10K/mo'],
            ['Monthly draw rate','~$10K','Year 1 avg · T&M basis'],
            ['Status','Active','No action needed']].map(([l,v,s])=>(
            <div key={l} style={{background:'#f5f6f8',borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontSize:11,color:C.textSub,marginBottom:3}}>{l}</div>
              <div style={{fontSize:18,fontWeight:600,color:C.text}}>{v}</div>
              <div style={{fontSize:11,color:C.textMuted}}>{s}</div>
            </div>
          ))}
        </Grid>
      </Card>

      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={()=>setSelected(null)}>
          {[['Order name',selected.order_name||'—'],['Customer',selected.customer],
            ['PM',selected.pm],['Status',selected.status],
            ['Grand total',fmtCurrency(selected.gt)],
            ['Remaining',fmtCurrency(selected.value||selected.remaining||0)],
            ['Confidence tier',selected.backlogTier||'—'],
            ['Confidence',selected.backlogConf?`${Math.round(selected.backlogConf*100)}%`:'—'],
            ['Weighted value',fmtCurrency(selected.backlogWeighted||0)],
            ['Days in status',selected.daysInStatus?`${selected.daysInStatus} days`:'—'],
          ].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}
    </div>
  );
}
