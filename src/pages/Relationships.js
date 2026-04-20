import React, { useState } from 'react';
import { Card, CardTitle, SectionLabel, Grid, Alert, Badge, Table, Modal, Insight, C } from '../components/UI';
import { useRelationshipData } from '../utils/dataHooks';
import { parseNum, fmtCurrency } from '../utils/sheets';

export default function Relationships({ data }) {
  const d = useRelationshipData(data);
  const [selected, setSelected] = useState(null);
  if (!d) return null;

  const companyQuotes = selected
    ? data.orders.filter(r=>r.customer===selected&&['Year 1','Year 2'].includes(r.year_bucket))
        .sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)).slice(0,20)
    : [];

  const STATUS_BADGE = { 'Going cold':'red','Rebuilding':'amber','Reactivation target':'purple','Active':'green','Inactive':'gray' };

  return (
    <div style={{ padding:'20px 24px', maxWidth:1320, margin:'0 auto' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>Relationships</h2>
      <p style={{ fontSize:12, color:C.textSub, marginBottom:12 }}>Going cold · rebuilding · reactivation · prospects · new sources · click any row for quote history</p>

      <Grid cols={4} gap={10} style={{ marginBottom:12 }}>
        {[
          { label:'Active sources (last 90d)', value:`${data.contacts.filter(r=>r.relationship_status==='Active').length}`, sub:'Companies with recent quotes', color:C.green },
          { label:'New dealers (last 90d)', value:`${d.newDealers.length}`, sub:'First-ever quote from this company', color:C.purple },
          { label:'Going cold', value:`${d.goingCold.length}`, sub:'Silent beyond threshold', color:d.goingCold.length>0?C.red:C.text },
          { label:'Rebuilding', value:`${d.rebuilding.length}`, sub:'Active pursuit in progress', color:C.amber },
        ].map((m,i)=>(
          <div key={i} style={{ background:'#f0f2f5', borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>{m.label}</div>
            <div style={{ fontSize:20, fontWeight:600, color:m.color||C.text }}>{m.value}</div>
            <div style={{ fontSize:11, color:C.textMuted }}>{m.sub}</div>
          </div>
        ))}
      </Grid>

      {d.goingCold.length > 0 && (
        <Alert type="amber"><strong>{d.goingCold.length} relationships going cold:</strong> {d.goingCold.slice(0,3).map(r=>r.company).join(', ')}{d.goingCold.length>3?` and ${d.goingCold.length-3} more`:''} — no quote beyond threshold.</Alert>
      )}

      <Grid cols={3} gap={10} style={{ marginBottom:12 }}>
        <Card>
          <CardTitle>Going cold</CardTitle>
          <Table cols={[
            { key:'company', label:'Dealer', width:'55%' },
            { key:'days_since_last_quote', label:'Last quote', width:'30%', render:v=><Badge type={parseNum(v)>180?'red':parseNum(v)>60?'red':'amber'}>{v}d ago</Badge> },
            { key:'post_acq_quotes', label:'Quotes', width:'15%' },
          ]} rows={d.goingCold} onRowClick={r=>setSelected(r.company)} />
        </Card>
        <Card>
          <CardTitle>Rebuilding + reactivation</CardTitle>
          <Table cols={[
            { key:'company', label:'Dealer', width:'50%' },
            { key:'pre_acq_quotes', label:'Pre-acq', width:'20%' },
            { key:'post_acq_quotes', label:'Post-acq', width:'20%' },
            { key:'relationship_status', label:'', width:'10%', render:v=><Badge type={STATUS_BADGE[v]||'gray'}>{v==='Rebuilding'?'↑':v==='Reactivation target'?'reactivate':'?'}</Badge> },
          ]} rows={[...d.rebuilding,...d.reactivation]} onRowClick={r=>setSelected(r.company)} />
          <Insight>Volume dropped at acquisition. Active outreach needed to restore pre-acquisition levels.</Insight>
        </Card>
        <Card>
          <CardTitle>Prospects + new sources</CardTitle>
          <Table cols={[
            { key:'company', label:'Company', width:'45%' },
            { key:'source', label:'Source', width:'30%', render:(v,row)=>v||<Badge type="purple">new dealer</Badge> },
            { key:'stage', label:'Stage', width:'25%', render:v=>v?<Badge type="amber">{v}</Badge>:<Badge type="blue">quoting</Badge> },
          ]} rows={[...d.newDealers.map(d=>({company:d.dealer,source:'New dealer',stage:'First quote: '+d.date})),...d.prospectList.map(p=>({company:p.company,source:p.source,stage:p.stage}))]} />
          <Insight>Add prospects directly in Google Sheet → prospects tab.</Insight>
        </Card>
      </Grid>

      <SectionLabel>All relationships — post-acquisition activity</SectionLabel>
      <Card>
        <Table cols={[
          { key:'company', label:'Company', width:'28%' },
          { key:'company_category', label:'Category', width:'13%', render:v=>v?<Badge type="gray">{v}</Badge>:'—' },
          { key:'relationship_status', label:'Status', width:'16%', render:v=><Badge type={STATUS_BADGE[v]||'gray'}>{v}</Badge> },
          { key:'post_acq_quotes', label:'Post-acq quotes', width:'13%' },
          { key:'pre_acq_quotes', label:'Pre-acq quotes', width:'12%' },
          { key:'days_since_last_quote', label:'Days since last', width:'12%', render:v=>v?`${v}d`:'—' },
          { key:'last_quote_date', label:'Last quote', width:'12%' },
        ]} rows={[...data.contacts].sort((a,b)=>parseNum(b.post_acq_quotes)-parseNum(a.post_acq_quotes))} onRowClick={r=>setSelected(r.company)} />
      </Card>

      {selected && (
        <Modal title={selected} onClose={()=>setSelected(null)}>
          <div style={{ fontSize:12, color:C.textSub, marginBottom:10 }}>Recent quote history (last 20)</div>
          <Table cols={[
            { key:'order_number', label:'#', width:'12%' },
            { key:'created_date', label:'Date', width:'18%' },
            { key:'pm', label:'PM', width:'22%' },
            { key:'grand_total', label:'Value', width:'16%', render:v=>fmtCurrency(parseNum(v)) },
            { key:'status', label:'Status', width:'32%', render:v=>{
              const won=['Invoiced','Installation Complete','In-Progress','Approved Order','Ready to Invoice','In-Progress - Phase Break','Implementation Complete'].includes(v);
              const lost=['Labor Quote Expired','Labor Quote Not Used'].includes(v);
              return <Badge type={won?'green':lost?'red':'gray'}>{v?.replace('Labor Quote ','')}</Badge>;
            }},
          ]} rows={companyQuotes} />
          {companyQuotes.length===0&&<p style={{color:C.textMuted,fontSize:12,textAlign:'center',padding:20}}>No post-acquisition quotes found</p>}
        </Modal>
      )}
    </div>
  );
}
