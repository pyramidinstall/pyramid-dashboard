import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, Modal, DetailRow, Insight, C } from '../components/UI';
import { useJobsInFlightData } from '../utils/dataHooks';
import { fmtCurrency, parseNum } from '../utils/sheets';

const TIER_COLORS = { 'Imminent':C.green,'On track':C.green,'Slight delay':C.amber,'Check in':C.red,'Follow up':C.red };
const TIER_BADGE  = { 'Imminent':'green','On track':'green','Slight delay':'amber','Check in':'red','Follow up':'red' };

function JobTable({ rows, selected, setSelected, showTotal, total, weighted }) {
  return <>
    <Table cols={[
      { key:'order_number', label:'#', width:'9%' },
      { key:'order_name', label:'Order name', width:'24%', render:(_,row)=>row.modification_notes||row.customer||'—' },
      { key:'customer', label:'Customer / PM', width:'22%', render:(_,row)=><span style={{fontSize:11}}>{row.customer}<br/><span style={{color:C.textMuted,fontSize:10}}>{row.pm}</span></span> },
      { key:'value', label:'Remaining', width:'12%', render:(_,row)=>fmtCurrency(parseNum(row.remaining_to_invoice||row.grand_total)) },
      { key:'created_date', label:'Since', width:'10%' },
      { key:'daysOld', label:'Days', width:'7%' },
      { key:'tier', label:'Status', width:'16%', render:v=>v?<Badge type={TIER_BADGE[v]||'gray'}>{v}</Badge>:'—' },
    ]} rows={rows} onRowClick={setSelected} />
    {showTotal && <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:6, fontSize:11, fontWeight:600, color:C.text }}>
      Total: {fmtCurrency(total)} · Weighted: {fmtCurrency(weighted)}
    </div>}
  </>;
}

export default function Backlog({ data }) {
  const d = useJobsInFlightData(data);
  const [selected, setSelected] = useState(null);
  if (!d) return null;

  const rtiOverdue = d.readyToInvoice.filter(r=>r.flag==='overdue');

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>Jobs in flight</h2>
      <p style={{ fontSize:12, color:C.textSub, marginBottom:12 }}>Three distinct stages. Click any row for detail.</p>

      {rtiOverdue.length > 0 && (
        <Alert type="red"><strong>Ready to invoice:</strong> {rtiOverdue.length} order{rtiOverdue.length>1?'s':''} over 7 days old. Work is done and approved. Review and send invoice today.</Alert>
      )}

      <SectionLabel>Ready to invoice — work complete, your review pending</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <Table cols={[
          { key:'order_number', label:'#', width:'9%' },
          { key:'order_name', label:'Order name', width:'24%', render:(_,row)=>row.modification_notes||row.customer||'—' },
          { key:'customer', label:'Customer / PM', width:'22%', render:(_,row)=><span style={{fontSize:11}}>{row.customer}<br/><span style={{color:C.textMuted,fontSize:10}}>{row.pm}</span></span> },
          { key:'value', label:'Value', width:'12%', render:(_,row)=>fmtCurrency(row.value) },
          { key:'created_date', label:'Since', width:'10%' },
          { key:'daysOld', label:'Days', width:'7%' },
          { key:'flag', label:'Flag', width:'16%', render:v=><Badge type={v==='overdue'?'red':v==='exclude'?'gray':'green'}>{v==='overdue'?'overdue':v==='exclude'?'exclude (>30d)':'new'}</Badge> },
        ]} rows={d.readyToInvoice} onRowClick={setSelected} />
        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:6, fontSize:11, fontWeight:600, color:C.text }}>
          Total: {fmtCurrency(d.rtiTotal)} · 90% confidence = {fmtCurrency(d.rtiWeighted)}
        </div>
        <Insight>Target: zero orders over 7 days. Exclude from revenue weighting at 30 days (likely phantom). These turn over in 1–3 days normally.</Insight>
      </Card>

      <SectionLabel>In-progress — scheduled with real dates, monitoring only</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <JobTable rows={d.inProgress} selected={selected} setSelected={setSelected} showTotal total={d.ipTotal} weighted={d.ipWeighted} />
        <Insight>Delays are out of your control once scheduled. Confirm status if aging significantly beyond expected duration.</Insight>
      </Card>

      <SectionLabel>Approved — PO or verbal received, awaiting scheduling</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <JobTable rows={d.approved} selected={selected} setSelected={setSelected} showTotal total={d.apTotal} weighted={d.apWeighted} />
        {d.checkinAlerts.length > 0 && (
          <Alert type="amber" style={{ marginTop:10 }}><strong>{d.checkinAlerts.length} jobs need a check-in</strong> — sitting beyond expected timing. Confirm still active and get updated ETA.</Alert>
        )}
      </Card>

      <SectionLabel>Skyline Windows — T&M draw-down (separate case)</SectionLabel>
      <Card style={{ marginBottom:12 }}>
        <Grid cols={3} gap={10}>
          {[['Estimated remaining','~$40K','~4 months at $10K/mo'],['Monthly draw rate','~$10K','Year 1 avg · T&M basis'],['Status','Active','No action needed — not a standard job']].map(([l,v,s])=>(
            <div key={l} style={{ background:'#f5f6f8', borderRadius:8, padding:'12px 14px' }}>
              <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:600, color:C.text }}>{v}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{s}</div>
            </div>
          ))}
        </Grid>
      </Card>

      {selected && (
        <Modal title={`Order #${selected.order_number}`} onClose={()=>setSelected(null)}>
          {[['Customer',selected.customer],['PM',selected.pm],['Status',selected.status],['Grand total',fmtCurrency(parseNum(selected.grand_total),false)],['Already invoiced',fmtCurrency(parseNum(selected.dollars_invoiced||0),false)],['Remaining',fmtCurrency(parseNum(selected.remaining_to_invoice||selected.grand_total),false)],['Confidence tier',selected.backlog_conf_tier],['Confidence',selected.backlog_confidence?`${Math.round(parseNum(selected.backlog_confidence)*100)}%`:'—'],['Weighted value',fmtCurrency(parseNum(selected.weighted_backlog||0),false)],['Days in status',selected.days_in_status?`${selected.days_in_status} days`:'—']].map(([k,v])=><DetailRow key={k} label={k} value={v}/>)}
        </Modal>
      )}
    </div>
  );
}
