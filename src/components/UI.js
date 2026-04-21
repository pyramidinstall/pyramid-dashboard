import React from 'react';

export const C = {
  green:'#1D9E75', blue:'#378ADD', amber:'#EF9F27', red:'#E24B4A',
  purple:'#534AB7', gray:'#888780', navy:'#1a1a2e',
  greenBg:'#E1F5EE', blueBg:'#E6F1FB', amberBg:'#FAEEDA', redBg:'#FCEBEB',
  greenTxt:'#0F6E56', blueTxt:'#185FA5', amberTxt:'#854F0B', redTxt:'#A32D2D',
  grayBg:'#F1EFE8', grayTxt:'#5F5E5A', purpleBg:'#EEEDFE', purpleTxt:'#3C3489',
  bg:'#f5f6f8', card:'#ffffff', border:'rgba(0,0,0,0.08)',
  text:'#1a1a2e', textSub:'#555', textMuted:'#888',
};

export function Card({children,style}){
  return <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',...style}}>{children}</div>;
}
export function CardTitle({children}){
  return <div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>{children}</div>;
}
export function MetricCard({label,value,sub,color,style,highlight}){
  return <div style={{background:highlight?C.greenBg:'#f0f2f5',borderRadius:8,padding:'12px 14px',border:highlight?`1px solid ${C.green}`:'none',...style}}>
    <div style={{fontSize:11,color:C.textSub,marginBottom:3}}>{label}</div>
    <div style={{fontSize:22,fontWeight:600,color:color||C.text}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{sub}</div>}
  </div>;
}
export function Badge({children,type='gray'}){
  const s={green:{bg:C.greenBg,txt:C.greenTxt},amber:{bg:C.amberBg,txt:C.amberTxt},red:{bg:C.redBg,txt:C.redTxt},blue:{bg:C.blueBg,txt:C.blueTxt},gray:{bg:C.grayBg,txt:C.grayTxt},purple:{bg:C.purpleBg,txt:C.purpleTxt}}[type]||{bg:C.grayBg,txt:C.grayTxt};
  return <span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,fontSize:11,background:s.bg,color:s.txt,fontWeight:500}}>{children}</span>;
}
export function Alert({children,type='amber'}){
  const s={amber:{bg:C.amberBg,border:C.amber,txt:C.amberTxt,dot:C.amber},red:{bg:C.redBg,border:C.red,txt:C.redTxt,dot:C.red},blue:{bg:C.blueBg,border:C.blue,txt:C.blueTxt,dot:C.blue}}[type]||{bg:C.amberBg,border:C.amber,txt:C.amberTxt,dot:C.amber};
  return <div style={{background:s.bg,border:`0.5px solid ${s.border}`,borderRadius:8,padding:'9px 13px',fontSize:12,color:s.txt,display:'flex',alignItems:'flex-start',gap:8,marginBottom:10}}>
    <div style={{width:8,height:8,borderRadius:'50%',background:s.dot,flexShrink:0,marginTop:2}}/>
    <div>{children}</div>
  </div>;
}
export function SectionLabel({children}){
  return <div style={{fontSize:10,fontWeight:600,color:C.textMuted,textTransform:'uppercase',letterSpacing:'.06em',margin:'18px 0 7px'}}>{children}</div>;
}
export function Grid({cols=2,gap=10,children,style}){
  return <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap,...style}}>{children}</div>;
}
export function Spinner(){
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
    <div style={{width:40,height:40,border:'3px solid #e0e0e0',borderTop:`3px solid ${C.green}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    <div style={{color:C.textSub,fontSize:14}}>Loading dashboard data...</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
export function InfoTooltip({children}){
  return <span style={{position:'relative',display:'inline-block'}} className="pyr-tip-wrap">
    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,borderRadius:'50%',background:'#f0f2f5',color:C.textMuted,fontSize:10,fontWeight:600,cursor:'help',marginLeft:4,verticalAlign:'middle',border:`0.5px solid ${C.border}`,fontFamily:'serif'}}>i</span>
    <span className="pyr-tip" style={{visibility:'hidden',opacity:0,position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',background:'#2C2C2A',color:'#F1EFE8',fontSize:11,lineHeight:1.5,fontWeight:400,padding:'8px 10px',borderRadius:6,whiteSpace:'normal',width:280,zIndex:1000,transition:'opacity 0.15s',pointerEvents:'none',textTransform:'none',letterSpacing:'normal'}}>
      {children}
    </span>
    <style>{`.pyr-tip-wrap:hover .pyr-tip{visibility:visible !important;opacity:1 !important;}`}</style>
  </span>;
}
export function TrendArrow({values}){
  if (!values||values.length<2) return <span style={{color:C.textMuted}}>—</span>;
  const last=values[values.length-1], prev=values[values.length-2];
  if (last===null||prev===null) return <span style={{color:C.textMuted}}>—</span>;
  const diff=last-prev;
  if (diff>0.05) return <span style={{color:C.green,fontWeight:700}}>▲</span>;
  if (diff<-0.05) return <span style={{color:C.red,fontWeight:700}}>▼</span>;
  return <span style={{color:C.textMuted}}>→</span>;
}
export function FreqArrow({trend}){
  if (trend==='up') return <span style={{color:C.green,fontWeight:700,fontSize:16}}>↑</span>;
  if (trend==='down') return <span style={{color:C.red,fontWeight:700,fontSize:16}}>↓</span>;
  return <span style={{color:C.textMuted,fontSize:16}}>→</span>;
}
export function CRBadge({value}){
  if (value===null||value===undefined) return <span style={{color:C.textMuted}}>—</span>;
  const pct=(value*100).toFixed(1)+'%';
  const type=value>=0.7?'green':value>=0.45?'amber':'red';
  return <Badge type={type}>{pct}</Badge>;
}
export function Table({cols,rows,onRowClick}){
  return <div style={{overflowX:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed'}}>
      <thead><tr>{cols.map(c=><th key={c.key} style={{textAlign:'left',fontWeight:600,color:C.textMuted,fontSize:11,padding:'4px 6px 8px 0',borderBottom:`0.5px solid ${C.border}`,width:c.width}}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((row,ri)=>(
        <tr key={ri} onClick={()=>onRowClick&&onRowClick(row)}
          style={{cursor:onRowClick?'pointer':'default',background:ri%2===1?'#fafafa':'transparent'}}
          onMouseEnter={e=>onRowClick&&(e.currentTarget.style.background='#f0f7ff')}
          onMouseLeave={e=>(e.currentTarget.style.background=ri%2===1?'#fafafa':'transparent')}>
          {cols.map(c=><td key={c.key} style={{padding:'6px 6px 6px 0',borderBottom:`0.5px solid ${C.border}`,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {c.render?c.render(row[c.key],row):row[c.key]}
          </td>)}
        </tr>
      ))}
      {rows.length===0&&<tr><td colSpan={cols.length} style={{padding:'20px 0',textAlign:'center',color:C.textMuted}}>No data</td></tr>}
      </tbody>
    </table>
  </div>;
}
export function Modal({title,onClose,children,wide}){
  const maxWidth = wide ? 900 : 520;
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
    <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:12,padding:24,maxWidth,width:'90%',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:700,color:C.text}}>{title}</h3>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.textMuted}}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
export function DetailRow({label,value}){
  return <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:13}}>
    <span style={{color:C.textSub}}>{label}</span>
    <span style={{color:C.text,fontWeight:500}}>{value||'—'}</span>
  </div>;
}
export function Insight({children}){
  return <div style={{background:'#f5f6f8',borderRadius:8,padding:'8px 10px',fontSize:11,color:C.textSub,marginTop:8}}>{children}</div>;
}
