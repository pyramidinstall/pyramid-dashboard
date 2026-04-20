import { useMemo } from 'react';
import { parseNum, parseBool } from './sheets';

const YEAR2_START = new Date('2026-04-01');
const TODAY = new Date();

export function useOverviewData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { invoices, orders, installnet } = data;

    const yr1Rev = invoices.filter(r=>r.year_bucket==='Year 1').reduce((s,r)=>s+parseNum(r.grand_total),0);
    const yr2Rev = invoices.filter(r=>r.year_bucket==='Year 2').reduce((s,r)=>s+parseNum(r.grand_total),0);
    const dayOfYear2 = Math.max(1,Math.floor((TODAY-YEAR2_START)/86400000)+1);

    const monthlyMap={};
    invoices.filter(r=>r.year_bucket==='Year 1').forEach(r=>{
      const m=r.month||''; if(m) monthlyMap[m]=(monthlyMap[m]||0)+parseNum(r.grand_total);
    });
    const monthly=Object.entries(monthlyMap).sort(([a],[b])=>a.localeCompare(b))
      .map(([month,revenue])=>({label:new Date(month+'-01').toLocaleString('default',{month:'short'}),revenue:Math.round(revenue)}));

    // Concentration — Year 1 revenue, Year 2 revenue, open pipeline
    const custY1={}, custY2={}, custPipe={};
    invoices.filter(r=>r.year_bucket==='Year 1').forEach(r=>{const c=r.customer||'Unknown'; custY1[c]=(custY1[c]||0)+parseNum(r.grand_total);});
    invoices.filter(r=>r.year_bucket==='Year 2').forEach(r=>{const c=r.customer||'Unknown'; custY2[c]=(custY2[c]||0)+parseNum(r.grand_total);});
    // Non-INET open quotes
    orders.filter(r=>parseBool(r.is_open_quote)).forEach(r=>{const c=r.customer||'Unknown'; custPipe[c]=(custPipe[c]||0)+parseNum(r.grand_total);});
    // INET open pipeline from PYR200
    if(installnet) {
      installnet.filter(r=>r.is_open_pipeline==='TRUE'||r.is_open_pipeline===true).forEach(r=>{
        const val=parseNum(r.installation_price||0);
        if(val>0) custPipe['INSTALL Net']=(custPipe['INSTALL Net']||0)+val;
      });
    }

    const totalPipe=Object.values(custPipe).reduce((s,v)=>s+v,0);
    const concentration=Object.entries(custY1).sort(([,a],[,b])=>b-a).slice(0,10)
      .map(([customer,y1Rev])=>({
        customer:customer.length>22?customer.slice(0,22)+'…':customer,
        y1Rev:Math.round(y1Rev), y1Pct:y1Rev/Math.max(yr1Rev,1),
        y2Rev:Math.round(custY2[customer]||0), y2Pct:(custY2[customer]||0)/Math.max(yr2Rev,1),
        pipePct:(custPipe[customer]||0)/Math.max(totalPipe,1),
        pipeVal:Math.round(custPipe[customer]||0),
      }));

    const recentQ=orders.filter(r=>{
      const d=new Date(r.created_date); return (TODAY-d)/86400000<=90&&(parseBool(r.is_open_quote)||parseBool(r.is_won));
    });
    const activePMs=new Set(recentQ.map(r=>r.pm).filter(Boolean)).size;
    const activeDealers=new Set(recentQ.map(r=>r.customer).filter(Boolean)).size;

    // Pipeline — non-INET open quotes only (INET pipeline shown separately)
    const openOrders=orders.filter(r=>parseBool(r.is_open_quote)&&r.channel!=='INSTALL Net');
    const pipelineFace=openOrders.reduce((s,r)=>s+parseNum(r.grand_total),0);
    const pipelineWeighted=openOrders.reduce((s,r)=>s+parseNum(r.pipeline_weighted||0),0);

    // INET open pipeline
    const inetPipelineFace=installnet?installnet.filter(r=>r.is_open_pipeline==='TRUE'||r.is_open_pipeline===true)
      .reduce((s,r)=>s+parseNum(r.installation_price||0),0):0;
    const inetPipelineWeighted=inetPipelineFace*0.778;

    const totalPipelineFace=pipelineFace+inetPipelineFace;
    const totalPipelineWeighted=pipelineWeighted+inetPipelineWeighted;

    // Jobs in flight — all backlog (INET + non-INET, Skyline separate)
    const rtiOrders=orders.filter(r=>r.status==='Ready to Invoice');
    const rtiValue=rtiOrders.filter(r=>parseNum(r.days_in_status)<=30)
      .reduce((s,r)=>s+parseNum(r.remaining_to_invoice||r.grand_total),0);

    const backlogOrders=orders.filter(r=>
      parseBool(r.is_backlog)&&r.status!=='Ready to Invoice'&&
      !String(r.customer||'').toUpperCase().includes('SKYLINE'));
    const backlogFace=backlogOrders.reduce((s,r)=>s+parseNum(r.remaining_to_invoice||r.grand_total),0);
    const backlogWeighted=backlogOrders.reduce((s,r)=>s+parseNum(r.weighted_backlog||0),0);
    const skylineRemaining=40000;
    const totalFlightFace=rtiValue+backlogFace+skylineRemaining;
    const totalFlightWeighted=rtiValue*0.95+backlogWeighted+skylineRemaining*0.95;

    return {
      yr1Rev,yr2Rev,dayOfYear2,monthly,concentration,activePMs,activeDealers,
      pipelineFace:Math.round(totalPipelineFace),
      pipelineWeighted:Math.round(totalPipelineWeighted),
      inetPipelineFace:Math.round(inetPipelineFace),
      inetPipelineWeighted:Math.round(inetPipelineWeighted),
      nonInetPipelineFace:Math.round(pipelineFace),
      nonInetPipelineWeighted:Math.round(pipelineWeighted),
      totalFlightFace:Math.round(totalFlightFace),
      totalFlightWeighted:Math.round(totalFlightWeighted),
      rtiValue:Math.round(rtiValue),
      backlogFace:Math.round(backlogFace),
      skylineRemaining,
      totalForwardFace:Math.round(totalPipelineFace+totalFlightFace),
      totalForwardWeighted:Math.round(totalPipelineWeighted+totalFlightWeighted),
    };
  },[data]);
}

export function usePipelineData(data) {
  return useMemo(()=>{
    if(!data) return null;
    const {orders,installnet}=data;
    // Non-INET open quotes
    const open=orders.filter(r=>parseBool(r.is_open_quote)&&r.channel!=='INSTALL Net');
    const cohorts=['XS <$1K','S $1K-5K','M $5K-15K','L $15K-50K','XL $50K+'];
    const byCohort=cohorts.map(c=>{
      const rows=open.filter(r=>r.cohort===c);
      return{cohort:c,count:rows.length,
        face:Math.round(rows.reduce((s,r)=>s+parseNum(r.grand_total),0)),
        weighted:Math.round(rows.reduce((s,r)=>s+parseNum(r.pipeline_weighted||0),0))};
    });
    const expiryAlerts=orders.filter(r=>r.expiry_alert)
      .sort((a,b)=>parseNum(a.days_to_expiry)-parseNum(b.days_to_expiry));
    const recentlyExpired=orders
      .filter(r=>r.status==='Labor Quote Expired'&&parseNum(r.grand_total)>=15000)
      .filter(r=>{const d=parseNum(r.days_to_expiry);return d<0&&d>-90;})
      .sort((a,b)=>parseNum(b.days_to_expiry)-parseNum(a.days_to_expiry));
    const nurture=open.filter(r=>parseNum(r.grand_total)>=25000)
      .sort((a,b)=>parseNum(b.grand_total)-parseNum(a.grand_total));
    const totalFace=open.reduce((s,r)=>s+parseNum(r.grand_total),0);
    const totalWeighted=open.reduce((s,r)=>s+parseNum(r.pipeline_weighted||0),0);

    // INET open pipeline from PYR200
    const inetOpen=installnet?installnet.filter(r=>r.is_open_pipeline==='TRUE'||r.is_open_pipeline===true):[];
    const inetPipelineFace=inetOpen.reduce((s,r)=>s+parseNum(r.installation_price||0),0);
    const inetPipelineWeighted=Math.round(inetPipelineFace*0.778);

    return{byCohort,expiryAlerts,recentlyExpired,nurture,allOpen:open,
      totalFace,totalWeighted,inetOpen,inetPipelineFace:Math.round(inetPipelineFace),inetPipelineWeighted};
  },[data]);
}

export function useJobsInFlightData(data) {
  return useMemo(()=>{
    if(!data) return null;
    const{orders}=data;
    const isSkyline=r=>String(r.customer||'').toUpperCase().includes('SKYLINE');

    const readyToInvoice=orders.filter(r=>r.status==='Ready to Invoice')
      .map(r=>({...r,daysOld:parseNum(r.days_in_status),value:parseNum(r.remaining_to_invoice||r.grand_total),
        flag:parseNum(r.days_in_status)>30?'exclude':parseNum(r.days_in_status)>7?'overdue':'ok'}))
      .sort((a,b)=>b.daysOld-a.daysOld);
    const validRTI=readyToInvoice.filter(r=>r.flag!=='exclude');
    const rtiTotal=validRTI.reduce((s,r)=>s+r.value,0);

    // In-Progress — includes INET, excludes Skyline
    const inProgress=orders.filter(r=>(r.status==='In-Progress'||r.status==='In-Progress - Phase Break')&&!isSkyline(r))
      .map(r=>({...r,daysOld:parseNum(r.days_in_status),value:parseNum(r.remaining_to_invoice||r.grand_total),tier:r.backlog_conf_tier}))
      .sort((a,b)=>b.daysOld-a.daysOld);

    // Approved — includes INET, excludes Skyline
    const approved=orders.filter(r=>r.status==='Approved Order'&&!isSkyline(r))
      .map(r=>({...r,daysOld:parseNum(r.days_in_status),value:parseNum(r.remaining_to_invoice||r.grand_total),tier:r.backlog_conf_tier}))
      .sort((a,b)=>b.daysOld-a.daysOld);

    const checkinAlerts=[...approved,...inProgress]
      .filter(r=>['Check in','Follow up'].includes(r.tier))
      .sort((a,b)=>b.daysOld-a.daysOld);

    return{
      readyToInvoice,rtiTotal:Math.round(rtiTotal),rtiWeighted:Math.round(rtiTotal*0.95),
      inProgress,ipTotal:Math.round(inProgress.reduce((s,r)=>s+r.value,0)),
      ipWeighted:Math.round(inProgress.reduce((s,r)=>s+parseNum(r.weighted_backlog||0),0)),
      approved,apTotal:Math.round(approved.reduce((s,r)=>s+r.value,0)),
      apWeighted:Math.round(approved.reduce((s,r)=>s+parseNum(r.weighted_backlog||0),0)),
      checkinAlerts,
    };
  },[data]);
}

export function useDealerData(data) {
  return useMemo(()=>{
    if(!data) return null;
    const{orders}=data;
    const quarters=['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'];
    // Non-INET only for dealer relationships
    const postOrders=orders.filter(r=>['Year 1','Year 2'].includes(r.year_bucket)&&r.channel!=='INSTALL Net');

    const pmMap={};
    postOrders.forEach(r=>{
      if(!r.pm) return;
      const key=r.customer+'||'+r.pm;
      if(!pmMap[key]) pmMap[key]={dealer:r.customer,pm:r.pm,quotes:[],won:0,decided:0,byQ:{}};
      const d=pmMap[key]; d.quotes.push(r);
      if(parseBool(r.is_decided)){d.decided++;if(parseBool(r.is_won))d.won++;}
      if(!d.byQ[r.quarter])d.byQ[r.quarter]={quotes:0,won:0,decided:0,value:0};
      d.byQ[r.quarter].quotes++;
      d.byQ[r.quarter].value+=parseNum(r.grand_total);
      if(parseBool(r.is_decided)){d.byQ[r.quarter].decided++;if(parseBool(r.is_won))d.byQ[r.quarter].won++;}
      if(!d.lastQuote||r.created_date>d.lastQuote) d.lastQuote=r.created_date;
    });

    const pmList=Object.values(pmMap).filter(d=>d.quotes.length>=3).map(d=>{
      const overallCR=d.decided>0?d.won/d.decided:null;
      const qCRs=quarters.map(q=>{const qd=d.byQ[q];return qd&&qd.decided>=2?qd.won/qd.decided:null;});
      const qVols=quarters.map(q=>d.byQ[q]?.quotes||0);
      const recentVol=(qVols[3]||0)+(qVols[4]||0),prevVol=(qVols[1]||0)+(qVols[2]||0);
      const freqTrend=recentVol>prevVol*1.1?'up':recentVol<prevVol*0.9?'down':'flat';
      const avgValue=Math.round(d.quotes.reduce((s,r)=>s+parseNum(r.grand_total),0)/d.quotes.length);
      const daysSince=d.lastQuote?Math.floor((TODAY-new Date(d.lastQuote))/86400000):null;
      const status=daysSince===null?'unknown':daysSince>45?'cold':daysSince>21?'watch':'active';
      const revenue=d.quotes.filter(r=>parseBool(r.is_won)).reduce((s,r)=>s+parseNum(r.grand_total),0);
      return{dealer:d.dealer,pm:d.pm,label:d.pm+' / '+d.dealer.split(' ')[0],
        totalQuotes:d.quotes.length,overallCR,qCRs,qVols,freqTrend,avgValue,daysSince,status,revenue};
    }).sort((a,b)=>b.totalQuotes-a.totalQuotes);

    // Dealer concentration — non-INET only
    const dealerRev={},dealerPipe={};
    postOrders.filter(r=>parseBool(r.is_won)&&r.year_bucket==='Year 1').forEach(r=>{dealerRev[r.customer]=(dealerRev[r.customer]||0)+parseNum(r.grand_total);});
    postOrders.filter(r=>parseBool(r.is_open_quote)).forEach(r=>{dealerPipe[r.customer]=(dealerPipe[r.customer]||0)+parseNum(r.pipeline_weighted||0);});
    const totalRev=Object.values(dealerRev).reduce((s,v)=>s+v,0);
    const totalPipe=Object.values(dealerPipe).reduce((s,v)=>s+v,0);
    const dealerConc=Object.entries(dealerRev).sort(([,a],[,b])=>b-a).slice(0,8).map(([dealer,rev])=>({
      dealer:dealer.length>18?dealer.slice(0,18)+'…':dealer,
      rev:Math.round(rev),revPct:rev/Math.max(totalRev,1),
      pipePct:(dealerPipe[dealer]||0)/Math.max(totalPipe,1),pipeVal:Math.round(dealerPipe[dealer]||0),
    }));

    const firstQuotes={};
    postOrders.forEach(r=>{
      const key=r.customer+'||'+r.pm;
      if(!firstQuotes[key]||r.created_date<firstQuotes[key].date)
        firstQuotes[key]={date:r.created_date,dealer:r.customer,pm:r.pm};
    });
    const cutoff=new Date(TODAY-90*86400000).toISOString().slice(0,10);
    const newSources=Object.values(firstQuotes).filter(s=>s.date>=cutoff).sort((a,b)=>b.date.localeCompare(a.date));

    return{pmList,dealerConc,newSources,quarters};
  },[data]);
}

export function useInetData(data) {
  return useMemo(()=>{
    if(!data) return null;
    const{installnet,invoices}=data;
    const quarters=['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'];
    const yr1=installnet.filter(r=>r.year_bucket==='Year 1');
    // Use won_complete (won AND not canceled) for close rate
    const decided=yr1.filter(r=>parseBool(r.decided)&&!parseBool(r.canceled));
    const won=decided.filter(r=>parseBool(r.won));
    const passed=yr1.filter(r=>parseBool(r.passed));
    const overallCR=decided.length>0?won.length/decided.length:0;

    // Actual Pyramid revenue from IQ invoices
    const pyramidRevenue=invoices.filter(r=>r.channel==='INSTALL Net'&&r.year_bucket==='Year 1')
      .reduce((s,r)=>s+parseNum(r.grand_total),0);
    const pyramidRevenueYr2=invoices.filter(r=>r.channel==='INSTALL Net'&&r.year_bucket==='Year 2')
      .reduce((s,r)=>s+parseNum(r.grand_total),0);

    // Open pipeline
    const openPipeline=installnet.filter(r=>r.is_open_pipeline==='TRUE'||r.is_open_pipeline===true);
    const pipelineFace=openPipeline.reduce((s,r)=>s+parseNum(r.installation_price||0),0);
    const pipelineWeighted=Math.round(pipelineFace*overallCR);

    const pmMap={};
    installnet.filter(r=>['Year 1','Year 2'].includes(r.year_bucket)).forEach(r=>{
      if(!r.pm) return;
      if(!pmMap[r.pm]) pmMap[r.pm]={pm:r.pm,quotes:[],won:0,decided:0,passed:0,canceled:0,byQ:{}};
      const d=pmMap[r.pm]; d.quotes.push(r);
      const isCanceled=parseBool(r.canceled);
      if(parseBool(r.decided)&&!isCanceled){d.decided++;if(parseBool(r.won))d.won++;}
      if(parseBool(r.passed))d.passed++;
      if(isCanceled)d.canceled++;
      if(!d.byQ[r.quarter])d.byQ[r.quarter]={quotes:0,won:0,decided:0,passed:0,value:0};
      d.byQ[r.quarter].quotes++;
      d.byQ[r.quarter].value+=parseNum(r.installation_price||0);
      if(parseBool(r.decided)&&!isCanceled){d.byQ[r.quarter].decided++;if(parseBool(r.won))d.byQ[r.quarter].won++;}
      if(parseBool(r.passed))d.byQ[r.quarter].passed++;
    });

    const pmList=Object.values(pmMap).filter(d=>d.quotes.length>=3).map(d=>{
      const overallCR=d.decided>0?d.won/d.decided:null;
      const qCRs=quarters.map(q=>{const qd=d.byQ[q];return qd&&qd.decided>=2?qd.won/qd.decided:null;});
      const qVols=quarters.map(q=>d.byQ[q]?.quotes||0);
      const qVals=quarters.map(q=>Math.round(d.byQ[q]?.value||0));
      const qNoBid=quarters.map(q=>d.byQ[q]?.passed||0);
      const recentVol=(qVols[3]||0)+(qVols[4]||0),prevVol=(qVols[1]||0)+(qVols[2]||0);
      const freqTrend=recentVol>prevVol*1.1?'up':recentVol<prevVol*0.9?'down':'flat';
      const avgValue=Math.round(d.quotes.reduce((s,r)=>s+parseNum(r.installation_price||0),0)/d.quotes.length);
      const lastDates=d.quotes.map(r=>r.date_requested).filter(Boolean).sort();
      const lastQuote=lastDates[lastDates.length-1];
      const daysSince=lastQuote?Math.floor((TODAY-new Date(lastQuote))/86400000):null;
      const revenue=d.quotes.filter(r=>parseBool(r.won)&&!parseBool(r.canceled))
        .reduce((s,r)=>s+parseNum(r.installation_price||0),0);
      const prevCR=qCRs[2],lastCR=qCRs[3];
      const crAlert=prevCR!==null&&lastCR!==null&&(prevCR-lastCR)>0.2;
      return{pm:d.pm,totalQuotes:d.quotes.length,overallCR,qCRs,qVols,qVals,qNoBid,
        freqTrend,avgValue,daysSince,revenue,crAlert,passed:d.passed,canceled:d.canceled};
    }).sort((a,b)=>b.totalQuotes-a.totalQuotes);

    const lossReasons={};
    yr1.filter(r=>parseBool(r.sp_lost)).forEach(r=>{
      const reason=r.loss_reason||'Unknown';
      lossReasons[reason]=(lossReasons[reason]||0)+1;
    });

    return{overallCR,pyramidRevenue:Math.round(pyramidRevenue),pyramidRevenueYr2:Math.round(pyramidRevenueYr2),
      decidedCount:decided.length,wonCount:won.length,passedCount:passed.length,
      pipelineFace:Math.round(pipelineFace),pipelineWeighted,
      pmList,lossReasons,quarters};
  },[data]);
}

export function useRelationshipData(data) {
  return useMemo(()=>{
    if(!data) return null;
    const{contacts,prospects,orders}=data;
    const goingCold=contacts.filter(r=>r.relationship_status==='Going cold')
      .sort((a,b)=>parseNum(b.days_since_last_quote)-parseNum(a.days_since_last_quote));
    const rebuilding=contacts.filter(r=>r.relationship_status==='Rebuilding');
    const reactivation=contacts.filter(r=>r.relationship_status==='Reactivation target');
    const cutoff=new Date(TODAY-90*86400000).toISOString().slice(0,10);
    const firstByDealer={};
    orders.forEach(r=>{if(!firstByDealer[r.customer]||r.created_date<firstByDealer[r.customer])firstByDealer[r.customer]=r.created_date;});
    const newDealers=Object.entries(firstByDealer).filter(([,d])=>d>=cutoff)
      .map(([dealer,date])=>({dealer,date})).sort((a,b)=>b.date.localeCompare(a.date));
    return{goingCold,rebuilding,reactivation,prospectList:prospects||[],newDealers};
  },[data]);
}
