import { useMemo } from 'react';
import { parseNum, parseBool } from './sheets';

// ── CONSTANTS ────────────────────────────────────────────────
const JORDAN_START = new Date('2025-04-01');
const YEAR2_START  = new Date('2026-04-01');
const TODAY        = new Date();

const EXCLUDE_STATUSES = new Set([
  'Recurring Order','Gratis - Not Invoiced','Open for Admin Editing'
]);
const WON_STATUSES = new Set([
  'Invoiced','Installation Complete','In-Progress','Approved Order',
  'Ready to Invoice','In-Progress - Phase Break','Implementation Complete'
]);
const LOST_STATUSES = new Set([
  'Labor Quote Expired','Labor Quote Not Used'
]);
const BACKLOG_STATUSES = new Set([
  'Approved Order','In-Progress','In-Progress - Phase Break','Ready to Invoice'
]);
const COHORT_BINS = [
  [0,      1000,   'XS <$1K'],
  [1000,   5000,   'S $1K-5K'],
  [5000,   15000,  'M $5K-15K'],
  [15000,  50000,  'L $15K-50K'],
  [50000,  Infinity,'XL $50K+'],
];

// ── PURE CALCULATION FUNCTIONS ───────────────────────────────
function getCohort(v) {
  for (const [lo, hi, label] of COHORT_BINS) {
    if (v > lo && v <= hi) return label;
  }
  return '';
}

function getYearBucket(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  if (d >= YEAR2_START)  return 'Year 2';
  if (d >= JORDAN_START) return 'Year 1';
  return 'Pre-acquisition';
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA), b = new Date(dateStrB);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((b - a) / 86400000);
}

function daysSinceToday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((TODAY - d) / 86400000);
}

function daysUntilToday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((d - TODAY) / 86400000);
}

function getBacklogConf(status, daysInStatus) {
  const ds = daysInStatus || 0;
  if (status === 'Ready to Invoice')
    return { tier: 'Ready to invoice', conf: 0.95 };
  if (status === 'In-Progress' || status === 'In-Progress - Phase Break') {
    if (ds <= 90)  return { tier: 'On track',     conf: 0.90 };
    if (ds <= 180) return { tier: 'Slight delay', conf: 0.85 };
    return           { tier: 'Check in',    conf: 0.80 };
  }
  if (status === 'Approved Order') {
    if (ds <= 90)  return { tier: 'On track',     conf: 0.90 };
    if (ds <= 180) return { tier: 'Slight delay', conf: 0.82 };
    return           { tier: 'Check in',    conf: 0.70 };
  }
  return { tier: 'On track', conf: 0.85 };
}

// ── CLOSE RATE CALCULATOR ────────────────────────────────────
function buildCloseRates(orders) {
  const pm = {}, dealer = {}, cohort = {};

  orders.forEach(r => {
    if (r.channel !== 'Non-INET') return;
    if (r.yearBucket !== 'Year 1' && r.yearBucket !== 'Year 2') return;
    if (!r.isDecided) return;

    const inc = (map, key) => {
      if (!key) return;
      if (!map[key]) map[key] = { won: 0, decided: 0 };
      map[key].decided++;
      if (r.isWon) map[key].won++;
    };
    inc(pm, r.pm);
    inc(dealer, r.customer);
    inc(cohort, r.cohort);
  });

  const rate = (map, key, min = 5) => {
    const d = map[key];
    if (!d || d.decided < min) return null;
    return d.won / d.decided;
  };

  return {
    getRate: (pmName, dealerName, cohortName, isInet) => {
      if (isInet) return 0.778;
      return rate(pm, pmName) ??
             rate(dealer, dealerName) ??
             rate(cohort, cohortName) ??
             0.40;
    }
  };
}

// ── ENRICH ORDERS ────────────────────────────────────────────
// Takes raw sheet rows and computes all derived fields
function enrichOrders(rawOrders) {
  // First pass — basic fields needed for close rate calc
  const pass1 = rawOrders
    .filter(r => {
      if (EXCLUDE_STATUSES.has(r.status)) return false;
      if (parseBool(r.ignore)) return false;
      return true;
    })
    .map(r => {
      const gt = parseNum(r.grand_total);
      const isInet = String(r.customer || '').includes('INSTALL Net');
      const isSkyline = String(r.customer || '').toUpperCase().includes('SKYLINE');
      const status = r.status || '';
      const isOpen = status === 'Labor Quote Presented';
      const isWon = WON_STATUSES.has(status);
      const isLost = LOST_STATUSES.has(status);
      const isBacklog = BACKLOG_STATUSES.has(status) && !isSkyline;
      const yearBucket = getYearBucket(r.created_date);
      const quarter = (() => {
        if (!r.created_date) return '';
        const d = new Date(r.created_date);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      })();
      const cohort = getCohort(gt);

      // Days calculations
      const statusStart = r.approved_start_date || r.inprog_start_date;
      const daysInStatus = statusStart ? daysSinceToday(statusStart) : null;
      const daysPresented = r.lqp_start_date ? daysSinceToday(r.lqp_start_date) : null;
      const daysToExpiry = r.expiry_date ? daysUntilToday(r.expiry_date) : null;

      const dinv = parseNum(r.dollars_invoiced);
      const remaining = isBacklog ? Math.max(0, gt - dinv) || (gt > 0 ? gt : 0) : null;

      return {
        ...r,
        gt, isInet, isSkyline, isOpen, isWon, isLost,
        isDecided: isWon || isLost,
        isBacklog, yearBucket, quarter, cohort,
        channel: isInet ? 'INSTALL Net' : 'Non-INET',
        daysInStatus, daysPresented, daysToExpiry, remaining,
      };
    });

  // Build close rates from pass1 data
  const cr = buildCloseRates(pass1);

  // Second pass — add weighted values
  return pass1.map(r => {
    let pipelineCR = null, pipelineWeighted = null;
    if (r.isOpen) {
      pipelineCR = cr.getRate(r.pm, r.customer, r.cohort, r.isInet);
      pipelineWeighted = Math.round(r.gt * pipelineCR);
    }

    let backlogConf = null, backlogTier = null, backlogWeighted = null;
    if (r.isBacklog) {
      const { tier, conf } = getBacklogConf(r.status, r.daysInStatus);
      backlogTier = tier;
      backlogConf = conf;
      backlogWeighted = r.remaining ? Math.round(r.remaining * conf) : null;
    }

    let expiryAlert = null;
    if (r.isOpen && r.gt >= 15000 && r.daysToExpiry !== null) {
      if (r.daysToExpiry <= 14)      expiryAlert = 'Expires within 14 days';
      else if (r.daysToExpiry <= 30) expiryAlert = 'Expires within 30 days';
    }

    return {
      ...r,
      pipelineCR, pipelineWeighted,
      backlogTier, backlogConf, backlogWeighted,
      expiryAlert,
    };
  });
}

// ── ENRICH INVOICES ──────────────────────────────────────────
function enrichInvoices(rawInvoices, orderMap) {
  return rawInvoices
    .filter(r => !parseBool(r.ignore))
    .map(r => {
      const orderRef = (() => {
        const ref = String(r.invoice_ref || '').trim();
        return ref.replace(/[A-Za-z]+$/, '').replace(/\.\d+$/, '');
      })();
      const order = orderMap[r.invoice_ref] || orderMap[orderRef];
      const customer = order?.customer || r.customer || 'Pre-acquisition order';
      const isInet = customer.includes('INSTALL Net');
      const yearBucket = getYearBucket(r.invoiced_date);
      const month = (() => {
        if (!r.invoiced_date) return '';
        const d = new Date(r.invoiced_date);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      const quarter = (() => {
        if (!r.invoiced_date) return '';
        const d = new Date(r.invoiced_date);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      })();
      return {
        ...r,
        customer,
        channel: isInet ? 'INSTALL Net' : 'Non-INET',
        pm: order?.pm || '',
        salesperson: order?.salesperson || '',
        yearBucket, month, quarter,
        gt: parseNum(r.grand_total),
      };
    });
}

// ── ENRICH INSTALLNET ────────────────────────────────────────
function enrichInstallnet(rawInet) {
  return rawInet
    .filter(r => !parseBool(r.ignore) && r.project_type !== 'Storage')
    .map(r => {
      const isSelected = parseNum(r.is_selected) === 1;
      const hasReason = r.loss_reason && String(r.loss_reason).trim() !== '';
      const isPassed = hasReason &&
        String(r.loss_reason).toLowerCase().includes('no bid was submitted');
      const isSpLost = !isSelected && hasReason && !isPassed;
      const isInetLost = !isSelected && !hasReason;
      const isCanceled = r.proj_status === 'Canceled';
      const isWon = isSelected;
      const isWonComplete = isWon && !isCanceled;
      const isDecided = isWonComplete || isSpLost;
      const isOpenPipeline = ['Final Quote','Project','Estimate'].includes(r.sp_bid_status);

      const yearBucket = getYearBucket(r.date_requested);
      const quarter = (() => {
        if (!r.date_requested) return '';
        const d = new Date(r.date_requested);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      })();

      let outcome = 'Open';
      if (isWonComplete)   outcome = 'Won';
      else if (isCanceled && isWon) outcome = 'Won - canceled';
      else if (isSpLost)   outcome = 'Lost - competitive';
      else if (isPassed)   outcome = 'Passed - no bid';
      else if (isInetLost) outcome = 'INET lost - moot';

      return {
        ...r,
        isSelected, isPassed, isSpLost, isInetLost,
        isWon, isWonComplete, isDecided, isCanceled,
        isOpenPipeline, outcome, yearBucket, quarter,
        price: parseNum(r.installation_price),
      };
    });
}

// ── MAIN DATA HOOK ───────────────────────────────────────────
// All enrichment happens here once when data loads
export function useEnrichedData(rawData) {
  return useMemo(() => {
    if (!rawData) return null;

    const orders = enrichOrders(rawData.orders || []);
    const orderMap = Object.fromEntries(orders.map(r => [r.order_number, r]));
    const invoices = enrichInvoices(rawData.invoices || [], orderMap);
    const installnet = enrichInstallnet(rawData.installnet || []);
    const contacts = (rawData.contacts || []).filter(r => !parseBool(r.ignore));
    const prospects = (rawData.prospects || []).filter(r => !parseBool(r.ignore));

    return { orders, invoices, installnet, contacts, prospects };
  }, [rawData]);
}

// ── DEBUG ────────────────────────────────────────────────────
export function debugData(rawData) {
  if (!rawData) return 'no data';
  const orders = rawData.orders || [];
  const inet = rawData.installnet || [];
  const openQ = orders.filter(r => r.status === 'Labor Quote Presented' && !parseBool(r.ignore));
  const inetOpen = inet.filter(r => ['Final Quote','Project','Estimate'].includes(r.sp_bid_status));
  return {
    rawOrders: orders.length,
    openQuotes: openQ.length,
    inetRows: inet.length,
    inetOpen: inetOpen.length,
    inetPipeline: inetOpen.reduce((s,r) => s + parseNum(r.installation_price||0), 0),
    sampleOrderKeys: orders.length > 0 ? Object.keys(orders[0]).slice(0,5) : [],
    sampleInetStatus: inet.slice(0,3).map(r => r.sp_bid_status),
  };
}

// ── PAGE-LEVEL DATA HOOKS ────────────────────────────────────
export function useOverviewData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders, invoices, installnet } = data;

    const yr1Rev = invoices.filter(r => r.yearBucket === 'Year 1').reduce((s,r) => s+r.gt, 0);
    const yr2Rev = invoices.filter(r => r.yearBucket === 'Year 2').reduce((s,r) => s+r.gt, 0);
    const dayOfYear2 = Math.max(1, Math.floor((TODAY - YEAR2_START) / 86400000) + 1);

    // Monthly revenue Year 1
    const monthlyMap = {};
    invoices.filter(r => r.yearBucket === 'Year 1').forEach(r => {
      if (r.month) monthlyMap[r.month] = (monthlyMap[r.month] || 0) + r.gt;
    });
    const monthly = Object.entries(monthlyMap).sort(([a],[b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({
        label: new Date(month + '-01').toLocaleString('default', { month: 'short' }),
        revenue: Math.round(revenue),
      }));

    // Concentration
    const custY1 = {}, custY2 = {}, custPipe = {};
    invoices.filter(r => r.yearBucket === 'Year 1').forEach(r => {
      custY1[r.customer] = (custY1[r.customer] || 0) + r.gt;
    });
    invoices.filter(r => r.yearBucket === 'Year 2').forEach(r => {
      custY2[r.customer] = (custY2[r.customer] || 0) + r.gt;
    });
    orders.filter(r => r.isOpen).forEach(r => {
      custPipe[r.customer] = (custPipe[r.customer] || 0) + r.gt;
    });
    // INET open pipeline
    installnet.filter(r => r.isOpenPipeline).forEach(r => {
      if (r.price > 0) custPipe['INSTALL Net'] = (custPipe['INSTALL Net'] || 0) + r.price;
    });

    const totalPipe = Object.values(custPipe).reduce((s,v) => s+v, 0);
    const concentration = Object.entries(custY1).sort(([,a],[,b]) => b-a).slice(0,10)
      .map(([customer, y1Rev]) => ({
        customer: customer.length > 22 ? customer.slice(0,22)+'…' : customer,
        y1Rev: Math.round(y1Rev), y1Pct: y1Rev / Math.max(yr1Rev, 1),
        y2Rev: Math.round(custY2[customer] || 0),
        y2Pct: (custY2[customer] || 0) / Math.max(yr2Rev, 1),
        pipePct: (custPipe[customer] || 0) / Math.max(totalPipe, 1),
        pipeVal: Math.round(custPipe[customer] || 0),
      }));

    // Active sources
    const cutoff90 = new Date(TODAY - 90 * 86400000);
    const recentQ = orders.filter(r => new Date(r.created_date) >= cutoff90 && (r.isOpen || r.isWon));
    const activePMs = new Set(recentQ.map(r => r.pm).filter(Boolean)).size;
    const activeDealers = new Set(recentQ.map(r => r.customer).filter(Boolean)).size;

    // Pipeline
    const openOrders = orders.filter(r => r.isOpen && !r.isInet);
    const pipelineFace = openOrders.reduce((s,r) => s + r.gt, 0);
    const pipelineWeighted = openOrders.reduce((s,r) => s + (r.pipelineWeighted || 0), 0);
    const inetPipelineFace = installnet.filter(r => r.isOpenPipeline).reduce((s,r) => s + r.price, 0);
    const inetPipelineWeighted = Math.round(inetPipelineFace * 0.778);

    // Jobs in flight
    const rtiOrders = orders.filter(r => r.status === 'Ready to Invoice');
    const rtiValue = rtiOrders.filter(r => (r.daysInStatus || 0) <= 30)
      .reduce((s,r) => s + (r.remaining || r.gt), 0);
    const backlogOrders = orders.filter(r => r.isBacklog && r.status !== 'Ready to Invoice');
    const backlogFace = backlogOrders.reduce((s,r) => s + (r.remaining || 0), 0);
    const backlogWeighted = backlogOrders.reduce((s,r) => s + (r.backlogWeighted || 0), 0);
    const skyline = 40000;

    return {
      yr1Rev, yr2Rev, dayOfYear2, monthly, concentration, activePMs, activeDealers,
      pipelineFace: Math.round(pipelineFace + inetPipelineFace),
      pipelineWeighted: Math.round(pipelineWeighted + inetPipelineWeighted),
      nonInetPipelineFace: Math.round(pipelineFace),
      nonInetPipelineWeighted: Math.round(pipelineWeighted),
      inetPipelineFace: Math.round(inetPipelineFace),
      inetPipelineWeighted,
      totalFlightFace: Math.round(rtiValue + backlogFace + skyline),
      totalFlightWeighted: Math.round(rtiValue * 0.95 + backlogWeighted + skyline * 0.95),
      rtiValue: Math.round(rtiValue),
      backlogFace: Math.round(backlogFace),
      skyline,
      totalForwardFace: Math.round(pipelineFace + inetPipelineFace + rtiValue + backlogFace + skyline),
      totalForwardWeighted: Math.round(pipelineWeighted + inetPipelineWeighted + rtiValue * 0.95 + backlogWeighted + skyline * 0.95),
    };
  }, [data]);
}

export function usePipelineData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders, installnet } = data;
    const open = orders.filter(r => r.isOpen && !r.isInet);
    const cohorts = ['XS <$1K','S $1K-5K','M $5K-15K','L $15K-50K','XL $50K+'];
    const byCohort = cohorts.map(c => {
      const rows = open.filter(r => r.cohort === c);
      return {
        cohort: c, count: rows.length,
        face: Math.round(rows.reduce((s,r) => s+r.gt, 0)),
        weighted: Math.round(rows.reduce((s,r) => s+(r.pipelineWeighted||0), 0)),
      };
    });
    const expiryAlerts = orders.filter(r => r.expiryAlert)
      .sort((a,b) => (a.daysToExpiry||0) - (b.daysToExpiry||0));
    const recentlyExpired = orders
      .filter(r => r.status==='Labor Quote Expired' && r.gt>=15000)
      .filter(r => r.daysToExpiry !== null && r.daysToExpiry < 0 && r.daysToExpiry > -90)
      .sort((a,b) => (b.daysToExpiry||0) - (a.daysToExpiry||0));
    const nurture = open.filter(r => r.gt >= 25000)
      .sort((a,b) => b.gt - a.gt);
    const inetOpen = installnet.filter(r => r.isOpenPipeline);
    const inetFace = Math.round(inetOpen.reduce((s,r) => s+r.price, 0));
    return {
      byCohort, expiryAlerts, recentlyExpired, nurture, allOpen: open,
      totalFace: Math.round(open.reduce((s,r)=>s+r.gt,0)),
      totalWeighted: Math.round(open.reduce((s,r)=>s+(r.pipelineWeighted||0),0)),
      inetOpen, inetFace, inetWeighted: Math.round(inetFace * 0.778),
    };
  }, [data]);
}

export function useJobsInFlightData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders } = data;

    const readyToInvoice = orders.filter(r => r.status === 'Ready to Invoice')
      .map(r => ({ ...r, value: r.remaining || r.gt,
        flag: (r.daysInStatus||0) > 30 ? 'exclude' : (r.daysInStatus||0) > 7 ? 'overdue' : 'ok' }))
      .sort((a,b) => (b.daysInStatus||0) - (a.daysInStatus||0));

    const inProgress = orders.filter(r =>
      (r.status==='In-Progress'||r.status==='In-Progress - Phase Break') && !r.isSkyline)
      .map(r => ({ ...r, value: r.remaining || r.gt }))
      .sort((a,b) => (b.daysInStatus||0) - (a.daysInStatus||0));

    const approved = orders.filter(r => r.status==='Approved Order' && !r.isSkyline)
      .map(r => ({ ...r, value: r.remaining || r.gt }))
      .sort((a,b) => (b.daysInStatus||0) - (a.daysInStatus||0));

    const validRTI = readyToInvoice.filter(r => r.flag !== 'exclude');
    const rtiTotal = validRTI.reduce((s,r) => s+r.value, 0);

    return {
      readyToInvoice,
      rtiTotal: Math.round(rtiTotal), rtiWeighted: Math.round(rtiTotal * 0.95),
      inProgress,
      ipTotal: Math.round(inProgress.reduce((s,r)=>s+r.value,0)),
      ipWeighted: Math.round(inProgress.reduce((s,r)=>s+(r.backlogWeighted||0),0)),
      approved,
      apTotal: Math.round(approved.reduce((s,r)=>s+r.value,0)),
      apWeighted: Math.round(approved.reduce((s,r)=>s+(r.backlogWeighted||0),0)),
      checkinAlerts: [...approved,...inProgress]
        .filter(r => ['Check in','Follow up'].includes(r.backlogTier))
        .sort((a,b) => (b.daysInStatus||0) - (a.daysInStatus||0)),
    };
  }, [data]);
}

export function useDealerData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders } = data;
    const quarters = ['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'];
    const postOrders = orders.filter(r =>
      (r.yearBucket==='Year 1'||r.yearBucket==='Year 2') && !r.isInet);

    const pmMap = {};
    postOrders.forEach(r => {
      if (!r.pm) return;
      const key = r.customer+'||'+r.pm;
      if (!pmMap[key]) pmMap[key] = { dealer:r.customer, pm:r.pm, quotes:[], won:0, decided:0, byQ:{}, lastDate:null };
      const d = pmMap[key];
      d.quotes.push(r);
      if (r.isDecided) { d.decided++; if (r.isWon) d.won++; }
      if (!d.byQ[r.quarter]) d.byQ[r.quarter] = { quotes:0, won:0, decided:0, value:0 };
      d.byQ[r.quarter].quotes++;
      d.byQ[r.quarter].value += r.gt;
      if (r.isDecided) { d.byQ[r.quarter].decided++; if(r.isWon) d.byQ[r.quarter].won++; }
      if (!d.lastDate || r.created_date > d.lastDate) d.lastDate = r.created_date;
    });

    const pmList = Object.values(pmMap).filter(d => d.quotes.length >= 3).map(d => {
      const overallCR = d.decided > 0 ? d.won / d.decided : null;
      const qCRs = quarters.map(q => {
        const qd = d.byQ[q];
        return qd && qd.decided >= 2 ? qd.won / qd.decided : null;
      });
      const qVols = quarters.map(q => d.byQ[q]?.quotes || 0);
      const rv = (qVols[3]||0)+(qVols[4]||0), pv = (qVols[1]||0)+(qVols[2]||0);
      const freqTrend = rv > pv*1.1 ? 'up' : rv < pv*0.9 ? 'down' : 'flat';
      const avgValue = Math.round(d.quotes.reduce((s,r)=>s+r.gt,0) / d.quotes.length);
      const daysSince = d.lastDate ? Math.floor((TODAY - new Date(d.lastDate)) / 86400000) : null;
      const status = daysSince===null?'unknown':daysSince>45?'cold':daysSince>21?'watch':'active';
      const revenue = d.quotes.filter(r=>r.isWon).reduce((s,r)=>s+r.gt,0);
      return { dealer:d.dealer, pm:d.pm, label:d.pm+' / '+d.dealer.split(' ')[0],
        totalQuotes:d.quotes.length, overallCR, qCRs, qVols, freqTrend, avgValue,
        daysSince, status, revenue };
    }).sort((a,b) => b.totalQuotes - a.totalQuotes);

    const dealerRev = {}, dealerPipe = {};
    postOrders.filter(r=>r.isWon&&r.yearBucket==='Year 1').forEach(r=>{dealerRev[r.customer]=(dealerRev[r.customer]||0)+r.gt;});
    postOrders.filter(r=>r.isOpen).forEach(r=>{dealerPipe[r.customer]=(dealerPipe[r.customer]||0)+(r.pipelineWeighted||0);});
    const totalRev=Object.values(dealerRev).reduce((s,v)=>s+v,0);
    const totalPipe=Object.values(dealerPipe).reduce((s,v)=>s+v,0);
    const dealerConc = Object.entries(dealerRev).sort(([,a],[,b])=>b-a).slice(0,8).map(([dealer,rev])=>({
      dealer: dealer.length>18?dealer.slice(0,18)+'…':dealer,
      rev:Math.round(rev), revPct:rev/Math.max(totalRev,1),
      pipePct:(dealerPipe[dealer]||0)/Math.max(totalPipe,1),
      pipeVal:Math.round(dealerPipe[dealer]||0),
    }));

    const firstQuotes = {};
    postOrders.forEach(r => {
      const key = r.customer+'||'+r.pm;
      if (!firstQuotes[key] || r.created_date < firstQuotes[key].date)
        firstQuotes[key] = { date:r.created_date, dealer:r.customer, pm:r.pm };
    });
    const cutoff = new Date(TODAY - 90*86400000).toISOString().slice(0,10);
    const newSources = Object.values(firstQuotes)
      .filter(s => s.date >= cutoff)
      .sort((a,b) => b.date.localeCompare(a.date));

    return { pmList, dealerConc, newSources, quarters };
  }, [data]);
}

export function useInetData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { installnet, invoices } = data;
    const quarters = ['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'];

    const yr1 = installnet.filter(r => r.yearBucket === 'Year 1');
    const decided = yr1.filter(r => r.isDecided);
    const won = decided.filter(r => r.isWonComplete);
    const passed = yr1.filter(r => r.isPassed);
    const overallCR = decided.length > 0 ? won.length / decided.length : 0;

    const pyramidRevenue = invoices.filter(r=>r.channel==='INSTALL Net'&&r.yearBucket==='Year 1')
      .reduce((s,r)=>s+r.gt,0);
    const pyramidRevenueYr2 = invoices.filter(r=>r.channel==='INSTALL Net'&&r.yearBucket==='Year 2')
      .reduce((s,r)=>s+r.gt,0);

    const openPipeline = installnet.filter(r => r.isOpenPipeline);
    const pipelineFace = openPipeline.reduce((s,r) => s+r.price, 0);

    const pmMap = {};
    installnet.filter(r=>r.yearBucket==='Year 1'||r.yearBucket==='Year 2').forEach(r => {
      if (!r.pm) return;
      if (!pmMap[r.pm]) pmMap[r.pm] = { pm:r.pm, quotes:[], won:0, decided:0, passed:0, canceled:0, byQ:{} };
      const d = pmMap[r.pm];
      d.quotes.push(r);
      if (r.isDecided) { d.decided++; if(r.isWonComplete) d.won++; }
      if (r.isPassed) d.passed++;
      if (r.isCanceled) d.canceled++;
      if (!d.byQ[r.quarter]) d.byQ[r.quarter]={quotes:0,won:0,decided:0,passed:0,value:0};
      d.byQ[r.quarter].quotes++;
      d.byQ[r.quarter].value += r.price;
      if (r.isDecided){d.byQ[r.quarter].decided++;if(r.isWonComplete)d.byQ[r.quarter].won++;}
      if (r.isPassed) d.byQ[r.quarter].passed++;
    });

    const pmList = Object.values(pmMap).filter(d=>d.quotes.length>=3).map(d=>{
      const overallCR = d.decided>0?d.won/d.decided:null;
      const qCRs=quarters.map(q=>{const qd=d.byQ[q];return qd&&qd.decided>=2?qd.won/qd.decided:null;});
      const qVols=quarters.map(q=>d.byQ[q]?.quotes||0);
      const qVals=quarters.map(q=>Math.round(d.byQ[q]?.value||0));
      const qNoBid=quarters.map(q=>d.byQ[q]?.passed||0);
      const rv=(qVols[3]||0)+(qVols[4]||0),pv=(qVols[1]||0)+(qVols[2]||0);
      const freqTrend=rv>pv*1.1?'up':rv<pv*0.9?'down':'flat';
      const avgValue=Math.round(d.quotes.reduce((s,r)=>s+r.price,0)/d.quotes.length);
      const lastDates=d.quotes.map(r=>r.date_requested).filter(Boolean).sort();
      const lastQuote=lastDates[lastDates.length-1];
      const daysSince=lastQuote?Math.floor((TODAY-new Date(lastQuote))/86400000):null;
      const revenue=d.quotes.filter(r=>r.isWonComplete).reduce((s,r)=>s+r.price,0);
      const crAlert=(qCRs[2]!==null&&qCRs[3]!==null&&(qCRs[2]-qCRs[3])>0.2);
      return{pm:d.pm,totalQuotes:d.quotes.length,overallCR,qCRs,qVols,qVals,qNoBid,
        freqTrend,avgValue,daysSince,revenue,crAlert,passed:d.passed,canceled:d.canceled};
    }).sort((a,b)=>b.totalQuotes-a.totalQuotes);

    const lossReasons = {};
    yr1.filter(r=>r.isSpLost).forEach(r=>{
      const reason=r.loss_reason||'Unknown';
      lossReasons[reason]=(lossReasons[reason]||0)+1;
    });

    return { overallCR, pyramidRevenue:Math.round(pyramidRevenue),
      pyramidRevenueYr2:Math.round(pyramidRevenueYr2),
      decidedCount:decided.length, wonCount:won.length, passedCount:passed.length,
      pipelineFace:Math.round(pipelineFace), pipelineWeighted:Math.round(pipelineFace*overallCR),
      pmList, lossReasons, quarters };
  }, [data]);
}

export function useRelationshipData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { contacts, prospects, orders } = data;

    // Build relationship status from order activity
    const postOrders = orders.filter(r => r.yearBucket==='Year 1'||r.yearBucket==='Year 2');
    const lastQuoteByCompany = {};
    const postCountByCompany = {};
    postOrders.forEach(r => {
      if (!lastQuoteByCompany[r.customer] || r.created_date > lastQuoteByCompany[r.customer])
        lastQuoteByCompany[r.customer] = r.created_date;
      postCountByCompany[r.customer] = (postCountByCompany[r.customer] || 0) + 1;
    });
    const preOrders = orders.filter(r => r.yearBucket === 'Pre-acquisition');
    const preCountByCompany = {};
    preOrders.forEach(r => {
      preCountByCompany[r.customer] = (preCountByCompany[r.customer] || 0) + 1;
    });

    const enrichedContacts = contacts.map(r => {
      const lastDate = lastQuoteByCompany[r.company];
      const daysSince = lastDate ? Math.floor((TODAY - new Date(lastDate)) / 86400000) : null;
      const post = postCountByCompany[r.company] || 0;
      const pre  = preCountByCompany[r.company] || 0;
      let status = 'Inactive';
      if (post >= 5 && (daysSince||0) > 21) status = 'Going cold';
      else if (post >= 1 && pre >= 5 && post < pre * 0.3) status = 'Rebuilding';
      else if (post < 3 && pre >= 5) status = 'Reactivation target';
      else if (post >= 3) status = 'Active';
      return { ...r, post_acq_quotes:post, pre_acq_quotes:pre,
        last_quote_date:lastDate||null, days_since_last_quote:daysSince,
        relationship_status:status };
    });

    const goingCold = enrichedContacts.filter(r=>r.relationship_status==='Going cold')
      .sort((a,b)=>(b.days_since_last_quote||0)-(a.days_since_last_quote||0));
    const rebuilding = enrichedContacts.filter(r=>r.relationship_status==='Rebuilding');
    const reactivation = enrichedContacts.filter(r=>r.relationship_status==='Reactivation target');

    const cutoff = new Date(TODAY - 90*86400000).toISOString().slice(0,10);
    const firstByDealer = {};
    orders.forEach(r => {
      if (!firstByDealer[r.customer] || r.created_date < firstByDealer[r.customer])
        firstByDealer[r.customer] = r.created_date;
    });
    const newDealers = Object.entries(firstByDealer)
      .filter(([,d]) => d >= cutoff)
      .map(([dealer,date]) => ({ dealer, date }))
      .sort((a,b) => b.date.localeCompare(a.date));

    return { goingCold, rebuilding, reactivation, enrichedContacts,
      prospectList:prospects||[], newDealers };
  }, [data]);
}
