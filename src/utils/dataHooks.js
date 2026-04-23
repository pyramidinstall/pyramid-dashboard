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
// Uses PM×cohort intersection with fallback chain, dollar-weighted
function buildCloseRates(orders) {
  // Buckets track dollar-weighted win rates: won$ / (won$ + lost$)
  const pmCohort = {}, pm = {}, dealerCohort = {}, dealer = {}, cohort = {};

  orders.forEach(r => {
    if (r.channel !== 'Non-INET') return;
    if (r.yearBucket !== 'Year 1' && r.yearBucket !== 'Year 2') return;
    if (!r.isDecided) return;

    const inc = (map, key) => {
      if (!key) return;
      if (!map[key]) map[key] = { wonD: 0, lostD: 0, wonN: 0, decidedN: 0 };
      map[key].decidedN++;
      if (r.isWon) { map[key].wonD += r.gt; map[key].wonN++; }
      else         { map[key].lostD += r.gt; }
    };
    if (r.pm && r.cohort)        inc(pmCohort, `${r.pm}|${r.cohort}`);
    if (r.pm)                    inc(pm, r.pm);
    if (r.customer && r.cohort)  inc(dealerCohort, `${r.customer}|${r.cohort}`);
    if (r.customer)              inc(dealer, r.customer);
    if (r.cohort)                inc(cohort, r.cohort);
  });

  // Dollar-weighted rate with minimum sample size
  const rate = (map, key, minDecided) => {
    const d = map[key];
    if (!d || d.decidedN < minDecided) return null;
    const denom = d.wonD + d.lostD;
    if (denom <= 0) return null;
    return d.wonD / denom;
  };

  return {
    // Returns { rate, source } — source identifies which fallback tier produced the rate
    getRate: (pmName, dealerName, cohortName, isInet) => {
      if (isInet) return { rate: 0.778, source: 'INET fixed' };
      // Priority: PM×cohort (3+) → PM (5+) → dealer×cohort (5+) → dealer (5+) → cohort (5+) → default
      let r;
      if ((r = rate(pmCohort, `${pmName}|${cohortName}`, 3)) !== null)       return { rate: r, source: 'PM×cohort' };
      if ((r = rate(pm, pmName, 5)) !== null)                                 return { rate: r, source: 'PM' };
      if ((r = rate(dealerCohort, `${dealerName}|${cohortName}`, 5)) !== null) return { rate: r, source: 'Dealer×cohort' };
      if ((r = rate(dealer, dealerName, 5)) !== null)                         return { rate: r, source: 'Dealer' };
      if ((r = rate(cohort, cohortName, 5)) !== null)                         return { rate: r, source: 'Cohort' };
      return { rate: 0.30, source: 'Default' };
    },
    // Cohort-level dollar-weighted rates for forecasting future quotes
    cohortRates: () => {
      const out = {};
      Object.keys(cohort).forEach(k => {
        const d = cohort[k];
        const denom = d.wonD + d.lostD;
        out[k] = denom > 0 ? d.wonD / denom : 0;
      });
      return out;
    },
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
      // Formal quote = went through LQP stage (has lqp_start_date). Excludes ad-hoc T&M orders.
      const isFormalQuote = !!r.lqp_start_date;

      const dinv = parseNum(r.dollars_invoiced);
      const remaining = isBacklog ? Math.max(0, gt - dinv) || (gt > 0 ? gt : 0) : null;

      return {
        ...r,
        gt, isInet, isSkyline, isOpen, isWon, isLost,
        isDecided: isWon || isLost,
        isBacklog, yearBucket, quarter, cohort, isFormalQuote,
        channel: isInet ? 'INSTALL Net' : 'Non-INET',
        daysInStatus, daysPresented, daysToExpiry, remaining,
      };
    });

  // Build close rates from pass1 data
  const cr_calc = buildCloseRates(pass1);

  // Second pass — add weighted values
  return pass1.map(r => {
    let pipelineCR = null, pipelineWeighted = null, pipelineCRSource = null;
    if (r.isOpen) {
      const cr = cr_calc.getRate(r.pm, r.customer, r.cohort, r.isInet);
      pipelineCR = cr.rate;
      pipelineCRSource = cr.source;
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
      pipelineCR, pipelineWeighted, pipelineCRSource,
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
      // Use payment_date for revenue recognition (when cash was received)
      // Fall back to invoiced_date if payment_date not available
      const revenueDate = r.payment_date || r.invoiced_date;
      const yearBucket = getYearBucket(revenueDate);
      const month = (() => {
        if (!revenueDate) return '';
        const d = new Date(revenueDate);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })();
      const quarter = (() => {
        if (!revenueDate) return '';
        const d = new Date(revenueDate);
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
function enrichUnpaid(rawUnpaid) {
  const today = new Date();
  today.setHours(0,0,0,0);
  return (rawUnpaid || [])
    .filter(r => !parseBool(r.ignore))
    .map(r => {
      // Overdue = due_date is in the past
      let isOverdue = false;
      let daysPastDue = null;
      if (r.due_date) {
        const due = new Date(r.due_date);
        if (!isNaN(due)) {
          due.setHours(0,0,0,0);
          const diffDays = Math.floor((today - due) / 86400000);
          if (diffDays > 0) {
            isOverdue = true;
            daysPastDue = diffDays;
          }
        }
      }
      return {
        ...r,
        gt: parseNum(r.grand_total),
        agingDays: parseNum(r.aging_days),
        agingDaysDue: parseNum(r.aging_days_due),
        isOverdue,
        daysPastDue,
        isPartial: r.payment_status === 'Partial',
      };
    });
}

export function useEnrichedData(rawData) {
  return useMemo(() => {
    if (!rawData) return null;

    const orders = enrichOrders(rawData.orders || []);
    const orderMap = Object.fromEntries(orders.map(r => [r.order_number, r]));
    const invoices = enrichInvoices(rawData.invoices || [], orderMap);
    const unpaid = enrichUnpaid(rawData.unpaid || []);
    const installnet = enrichInstallnet(rawData.installnet || []);
    const contacts = (rawData.contacts || []).filter(r => !parseBool(r.ignore));
    const prospects = (rawData.prospects || []).filter(r => !parseBool(r.ignore));

    return { orders, invoices, unpaid, installnet, contacts, prospects };
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
    const { orders, invoices, unpaid, installnet } = data;

    // ── REVENUE COLLECTED ────────────────────────────────────
    const yr1Rev = invoices.filter(r => r.yearBucket === 'Year 1').reduce((s,r) => s+r.gt, 0);
    const yr2Rev = invoices.filter(r => r.yearBucket === 'Year 2').reduce((s,r) => s+r.gt, 0);
    const dayOfYear2 = Math.max(1, Math.floor((TODAY - YEAR2_START) / 86400000) + 1);
    const daysRemaining = Math.max(0, 365 - dayOfYear2);

    // ── AR (invoiced, unpaid) ────────────────────────────────
    const arTotal = (unpaid || []).reduce((s,r) => s + r.gt, 0);
    const arWeighted = Math.round(arTotal * 0.98);
    const arOverdue = (unpaid || []).filter(r => r.isOverdue);
    const arOverdueTotal = arOverdue.reduce((s,r) => s + r.gt, 0);

    // ── PIPELINE (open quotes, weighted) ─────────────────────
    // Non-INET non-XL gets cohort/PM weighting. XL excluded from forecast.
    const openNonInet = orders.filter(r => r.isOpen && !r.isInet);
    const openNonInetExXL = openNonInet.filter(r => r.cohort !== 'XL $50K+');
    const pipelineFaceExXL = openNonInetExXL.reduce((s,r) => s + r.gt, 0);
    const pipelineWeightedExXL = openNonInetExXL.reduce((s,r) => s + (r.pipelineWeighted || 0), 0);
    const inetPipelineFace = installnet.filter(r => r.isOpenPipeline).reduce((s,r) => s + r.price, 0);
    const inetPipelineWeighted = Math.round(inetPipelineFace * 0.778);
    const pipelineFace = pipelineFaceExXL + inetPipelineFace;
    const pipelineWeighted = pipelineWeightedExXL + inetPipelineWeighted;

    // ── JOBS IN FLIGHT (won, awaiting invoicing, weighted) ───
    const rtiOrders = orders.filter(r => r.status === 'Ready to Invoice');
    const rtiValue = rtiOrders.filter(r => (r.daysInStatus || 0) <= 30)
      .reduce((s,r) => s + (r.remaining || r.gt), 0);
    const backlogOrders = orders.filter(r => r.isBacklog && r.status !== 'Ready to Invoice');
    const backlogFace = backlogOrders.reduce((s,r) => s + (r.remaining || 0), 0);
    const backlogWeighted = backlogOrders.reduce((s,r) => s + (r.backlogWeighted || 0), 0);
    // Skyline: T&M job with ~$10K/mo and 2-3 months remaining
    const skylineRemaining = 30000;
    const flightFace = rtiValue + backlogFace + skylineRemaining;
    const flightWeighted = Math.round(rtiValue * 0.95 + backlogWeighted + skylineRemaining * 0.90);

    // ── COMMITTED = Collected + AR + In Flight + Pipeline ───
    const committed = yr2Rev + arWeighted + flightWeighted + pipelineWeighted;

    // ── FUTURE QUOTE FORECAST (scenarios) ───────────────────
    // Base: Year 1 monthly quote flow × cohort dollar-weighted CRs × months remaining (capped by 86-day sales cycle)
    // Bear: 2nd-worst month of Year 1 applied same way
    // Bull: trailing 90-day pace, only if > Year 1 avg
    const NON_INET_SALES_CYCLE_DAYS = 86;
    const INET_SALES_CYCLE_DAYS = 37;
    // Quotes created after day (365 - cycle) won't convert to Year 2 revenue
    const nonInetEffectiveDays = Math.max(0, Math.min(daysRemaining, 365 - NON_INET_SALES_CYCLE_DAYS - dayOfYear2));
    const inetEffectiveDays    = Math.max(0, Math.min(daysRemaining, 365 - INET_SALES_CYCLE_DAYS - dayOfYear2));

    // Compute Year 1 monthly non-INET formal quote dollars by cohort (ex-XL)
    const y1NonInetFormal = orders.filter(r =>
      r.yearBucket === 'Year 1' && !r.isInet && r.isFormalQuote && r.cohort !== 'XL $50K+'
    );
    const y1MonthlyByCohort = {}; // cohort -> { [month]: dollars }
    y1NonInetFormal.forEach(r => {
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      const mkey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!y1MonthlyByCohort[r.cohort]) y1MonthlyByCohort[r.cohort] = {};
      y1MonthlyByCohort[r.cohort][mkey] = (y1MonthlyByCohort[r.cohort][mkey] || 0) + r.gt;
    });
    // Base monthly cohort quote dollars (12-month average)
    const baseCohortQuoteMo = {};
    // Bear monthly cohort quote dollars (2nd-worst total month scaled)
    const cohortLabels = ['XS <$1K','S $1K-5K','M $5K-15K','L $15K-50K'];
    cohortLabels.forEach(c => {
      const m = y1MonthlyByCohort[c] || {};
      const vals = Object.values(m);
      const total = vals.reduce((s,v) => s+v, 0);
      baseCohortQuoteMo[c] = total / 12;
    });

    // Year 1 total monthly quote dollars (non-INET ex-XL, all cohorts)
    const y1TotalByMonth = {};
    y1NonInetFormal.forEach(r => {
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      const mkey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      y1TotalByMonth[mkey] = (y1TotalByMonth[mkey] || 0) + r.gt;
    });
    const y1MonthlyTotals = Object.values(y1TotalByMonth).sort((a,b) => a-b);
    const y1AvgMonthly = y1MonthlyTotals.reduce((s,v) => s+v, 0) / Math.max(y1MonthlyTotals.length, 1);
    const y1SecondWorstMonthly = y1MonthlyTotals.length >= 2 ? y1MonthlyTotals[1] : (y1MonthlyTotals[0] || 0);

    // Cohort dollar-weighted close rates
    const cr_calc = buildCloseRates(orders);
    const cohortCRs = cr_calc.cohortRates();

    // Base monthly expected revenue from non-INET future quotes
    const baseMoExpected = cohortLabels.reduce((s, c) => {
      const qMo = baseCohortQuoteMo[c] || 0;
      const cr = cohortCRs[c] || 0.30;
      return s + qMo * cr;
    }, 0);
    // Bear: use 2nd-worst month as proxy, distribute across cohorts proportionally
    const y1AvgMoTotal = Object.values(baseCohortQuoteMo).reduce((s,v) => s+v, 0);
    const bearScale = y1AvgMoTotal > 0 ? y1SecondWorstMonthly / y1AvgMoTotal : 0;
    const bearMoExpected = baseMoExpected * bearScale;

    // INET: Year 1 revenue avg / 12 ≈ $70K/mo actual collected
    const y1InetRev = invoices.filter(r => r.yearBucket === 'Year 1' && r.channel === 'INSTALL Net').reduce((s,r) => s+r.gt, 0);
    const inetMoExpected = y1InetRev / 12;

    // Compute future revenue (ex-XL, from quotes not yet sent)
    const nonInetEffectiveMonths = nonInetEffectiveDays / 30;
    const inetEffectiveMonths    = inetEffectiveDays / 30;

    const baseFuture = baseMoExpected * nonInetEffectiveMonths + inetMoExpected * inetEffectiveMonths;
    const bearFuture = bearMoExpected * nonInetEffectiveMonths + inetMoExpected * inetEffectiveMonths * 0.7;

    // Bull: trailing 90-day non-INET formal pace
    const cutoff90 = new Date(TODAY - 90 * 86400000);
    const trailing90 = y1NonInetFormal.concat(
      orders.filter(r => r.yearBucket === 'Year 2' && !r.isInet && r.isFormalQuote && r.cohort !== 'XL $50K+')
    ).filter(r => new Date(r.created_date) >= cutoff90);
    const trailing90Dollars = trailing90.reduce((s,r) => s+r.gt, 0);
    const trailing90MoDollars = trailing90Dollars / 3;
    // Scale bull only if > Y1 avg
    const bullScale = trailing90MoDollars > y1AvgMonthly ? trailing90MoDollars / y1AvgMonthly : 1.0;
    const bullMoExpected = baseMoExpected * bullScale;
    const bullFuture = bullMoExpected * nonInetEffectiveMonths + inetMoExpected * inetEffectiveMonths * 1.1;

    // Forecast totals = committed + future
    const forecastBase = committed + baseFuture;
    const forecastBear = committed + bearFuture;
    const forecastBull = committed + bullFuture;

    // Coverage: how many months of $3M target does committed cover?
    const monthlyTarget = 3000000 / 12;
    const coverageMonths = committed / monthlyTarget;

    // ── XL BOUNTY (open $50K+ non-INET quotes) ───────────────
    const xlBounty = orders
      .filter(r => r.isOpen && !r.isInet && r.gt >= 50000)
      .sort((a,b) => b.gt - a.gt)
      .map(r => ({
        order_number: r.order_number,
        order_name: r.order_name,
        customer: r.customer,
        pm: r.pm,
        gt: r.gt,
      }));

    // ── MOMENTUM (last 30 days) ──────────────────────────────
    const cutoff30 = new Date(TODAY - 30 * 86400000);

    // Non-INET formal quotes, last 30 days
    const nonInetFormal30 = orders.filter(r =>
      !r.isInet && r.isFormalQuote && new Date(r.created_date) >= cutoff30
    );
    const nonInetDollars30 = nonInetFormal30.reduce((s,r) => s+r.gt, 0);

    // INET quotes, last 30 days
    const inet30 = installnet.filter(r => r.date_requested && new Date(r.date_requested) >= cutoff30);
    const inetDollars30 = inet30.reduce((s,r) => s+r.price, 0);

    // Total
    const totalQuotes30 = nonInetFormal30.length + inet30.length;
    const totalQuotesDollars30 = nonInetDollars30 + inetDollars30;

    // Build unified list for drill-down (ordered by most recent)
    const allQuotes30 = [
      ...nonInetFormal30.map(r => ({
        type: 'Non-INET',
        number: r.order_number,
        order_name: r.order_name,
        customer: r.customer,
        pm: r.pm,
        value: r.gt,
        date: r.created_date,
        status: r.status,
      })),
      ...inet30.map(r => ({
        type: 'INET',
        number: r.project_id,
        order_name: r.project_name,
        customer: 'INSTALL Net',
        pm: r.pm,
        value: r.price,
        date: r.date_requested,
        status: r.sp_bid_status,
      })),
    ].sort((a,b) => new Date(b.date) - new Date(a.date));

    // Year 1 monthly baselines (non-INET formal)
    const y1NonInetFormalCount = y1NonInetFormal.length;
    const y1NonInetFormalDollars = y1NonInetFormal.reduce((s,r) => s+r.gt, 0);
    const y1MonthlyNonInetFormal = y1NonInetFormalCount / 12;
    const y1MonthlyNonInetDollars = y1NonInetFormalDollars / 12;

    // Year 1 monthly baselines (INET) — count and dollars
    const y1Inet = installnet.filter(r => r.yearBucket === 'Year 1');
    const y1InetCount = y1Inet.length;
    const y1InetQuoteDollars = y1Inet.reduce((s,r) => s+r.price, 0);
    const y1MonthlyInetCount = y1InetCount / 12;
    const y1MonthlyInetDollars = y1InetQuoteDollars / 12;

    // Year 1 totals
    const y1MonthlyTotalQuotes = (y1NonInetFormalCount + y1InetCount) / 12;
    const y1MonthlyTotalDollars = (y1NonInetFormalDollars + y1InetQuoteDollars) / 12;

    // Deltas: count and dollar for each channel
    const deltaPct = (current, baseline) => baseline > 0 ? (current - baseline) / baseline : 0;
    const nonInetCountDelta  = deltaPct(nonInetFormal30.length, y1MonthlyNonInetFormal);
    const nonInetDollarDelta = deltaPct(nonInetDollars30,       y1MonthlyNonInetDollars);
    const inetCountDelta     = deltaPct(inet30.length,          y1MonthlyInetCount);
    const inetDollarDelta    = deltaPct(inetDollars30,          y1MonthlyInetDollars);
    const totalQuotesDelta   = deltaPct(totalQuotes30,          y1MonthlyTotalQuotes);

    // New PMs in last 30 days (first-ever quote anywhere in our data)
    const pmFirstSeen = {};
    orders.forEach(r => {
      if (!r.pm) return;
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      if (!pmFirstSeen[r.pm] || d < pmFirstSeen[r.pm]) pmFirstSeen[r.pm] = d;
    });
    const newPMs30 = Object.entries(pmFirstSeen)
      .filter(([, d]) => d >= cutoff30)
      .map(([pm, firstDate]) => {
        const rows = orders.filter(r => r.pm === pm);
        const dealer = rows[0]?.customer || '';
        return { pm, firstDate: firstDate.toISOString().slice(0,10), dealer, quoteCount: rows.length };
      })
      .sort((a,b) => b.quoteCount - a.quoteCount);

    // New dealers in last 60 days
    const cutoff60 = new Date(TODAY - 60 * 86400000);
    const dealerFirstSeen = {};
    orders.forEach(r => {
      if (!r.customer) return;
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      if (!dealerFirstSeen[r.customer] || d < dealerFirstSeen[r.customer]) dealerFirstSeen[r.customer] = d;
    });
    const newDealers60 = Object.entries(dealerFirstSeen)
      .filter(([, d]) => d >= cutoff60)
      .map(([customer, firstDate]) => {
        const rows = orders.filter(r => r.customer === customer);
        return { customer, firstDate: firstDate.toISOString().slice(0,10), quoteCount: rows.length };
      })
      .sort((a,b) => b.quoteCount - a.quoteCount);

    // ── ATTENTION LIST (data-resolved) ────────────────────────
    // L+ quotes expiring within 14 days
    const expiring14 = orders.filter(r =>
      r.isOpen && r.gt >= 15000 && r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 14
    );
    const expiring14Names = [...new Set(expiring14.map(r => (r.customer || '').split(' ')[0]))].slice(0, 4).join(', ');

    // RTI > 7 days
    const rtiOver7 = orders.filter(r =>
      r.status === 'Ready to Invoice' && (r.daysInStatus || 0) > 7
    );

    // AR past due (using unpaid with isOverdue)
    const arOverdueValue = arOverdue.reduce((s,r) => s+r.gt, 0);

    // Cold PMs — PM silent for 21+ days (last quote > 21 days ago, had quotes in prior 90 days)
    const pmLastSeen = {};
    orders.forEach(r => {
      if (!r.pm || !r.created_date) return;
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      if (!pmLastSeen[r.pm] || d > pmLastSeen[r.pm]) pmLastSeen[r.pm] = d;
    });
    const cutoff21 = new Date(TODAY - 21 * 86400000);
    const cutoff112 = new Date(TODAY - 112 * 86400000); // 21 + 91 days
    const coldPMs = Object.entries(pmLastSeen).filter(([pm, lastDate]) => {
      if (lastDate >= cutoff21) return false; // not silent
      if (lastDate < cutoff112) return false; // been gone too long to count as "going cold"
      // had 3+ quotes in Year 1 (active relationship)
      const y1Count = orders.filter(r => r.pm === pm && r.yearBucket === 'Year 1').length;
      return y1Count >= 3;
    }).map(([pm]) => pm);

    // Approved orders aging 90+ days
    const approvedAging90 = orders.filter(r =>
      r.status === 'Approved Order' && (r.daysInStatus || 0) > 90
    );
    const approvedAging90Value = approvedAging90.reduce((s,r) => s + (r.remaining || r.gt), 0);

    // Dealers going cold — dealer with 3+ Year 1 quotes but no quote in 60 days
    const dealerLastSeen = {};
    orders.forEach(r => {
      if (!r.customer || !r.created_date || r.isInet) return;
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      if (!dealerLastSeen[r.customer] || d > dealerLastSeen[r.customer]) dealerLastSeen[r.customer] = d;
    });
    const coldDealers = Object.entries(dealerLastSeen).filter(([c, lastDate]) => {
      if (lastDate >= cutoff60) return false;
      const y1Count = orders.filter(r => r.customer === c && r.yearBucket === 'Year 1').length;
      return y1Count >= 3;
    }).map(([c]) => c);

    // Cold dealers — enrich with last seen date
    const coldDealerDetails = coldDealers.map(c => {
      const last = dealerLastSeen[c];
      const y1Count = orders.filter(r => r.customer === c && r.yearBucket === 'Year 1').length;
      return {
        customer: c,
        lastQuoteDate: last ? last.toISOString().slice(0,10) : '—',
        daysSilent: last ? Math.floor((TODAY - last) / 86400000) : null,
        y1Count,
      };
    }).sort((a,b) => (b.daysSilent||0) - (a.daysSilent||0));

    // Cold PMs — enrich with last seen
    const coldPMDetails = coldPMs.map(pm => {
      const last = pmLastSeen[pm];
      const y1Count = orders.filter(r => r.pm === pm && r.yearBucket === 'Year 1').length;
      return {
        pm,
        lastQuoteDate: last ? last.toISOString().slice(0,10) : '—',
        daysSilent: last ? Math.floor((TODAY - last) / 86400000) : null,
        y1Count,
      };
    }).sort((a,b) => (b.daysSilent||0) - (a.daysSilent||0));

    // Smart detail text — handle single-item specially
    const smartDetail = (items, getName, fallback) => {
      if (items.length === 0) return fallback;
      if (items.length === 1) return getName(items[0]);
      const names = items.slice(0, 3).map(getName).filter(Boolean);
      const more = items.length > 3 ? ` +${items.length - 3} more` : '';
      return names.join(', ') + more;
    };

    const attentionList = [
      { key:'expiring14', severity:'red', count:expiring14.length,
        label:'L+ quotes expiring within 14 days',
        detail: smartDetail(expiring14, r => r.customer, 'see Pipeline'),
        amount: expiring14.reduce((s,r) => s+r.gt, 0),
        items: expiring14,
        itemType: 'quote',
        show: expiring14.length > 0 },
      { key:'rti7', severity:'red', count:rtiOver7.length,
        label:'Ready to invoice over 7 days old',
        detail: smartDetail(rtiOver7, r => r.customer, 'process and send invoices'),
        amount: rtiOver7.reduce((s,r) => s + (r.remaining || r.gt), 0),
        items: rtiOver7,
        itemType: 'order',
        show: rtiOver7.length > 0 },
      { key:'ar', severity:'red', count:arOverdue.length,
        label:'Invoices past due date',
        detail: smartDetail(arOverdue, r => r.customer, 'collect payment'),
        amount: arOverdueValue,
        items: arOverdue,
        itemType: 'invoice',
        show: arOverdue.length > 0 },
      { key:'coldPM', severity:'amber', count:coldPMDetails.length,
        label:'PMs silent 21+ days',
        detail: smartDetail(coldPMDetails, r => {
          const p = r.pm.split(' ');
          return p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase();
        }, 'see Relationships'),
        amount:null, amountLabel:'reach out',
        items: coldPMDetails,
        itemType: 'pm',
        show: coldPMDetails.length > 0 },
      { key:'aging90', severity:'amber', count:approvedAging90.length,
        label:'Approved orders aging 90+ days',
        detail: smartDetail(approvedAging90, r => r.customer, 'status check'),
        amount:approvedAging90Value,
        items: approvedAging90,
        itemType: 'order',
        show: approvedAging90.length > 0 },
      { key:'coldDealers', severity:'amber', count:coldDealerDetails.length,
        label:'Dealers going cold',
        detail: smartDetail(coldDealerDetails, r => r.customer, 'monitor'),
        amount:null, amountLabel:'priority',
        items: coldDealerDetails,
        itemType: 'dealer',
        show: coldDealerDetails.length > 0 },
    ].filter(x => x.show);

    // ── CONCENTRATION (simplified) ───────────────────────────
    const custY1 = {}, custY2 = {};
    invoices.filter(r => r.yearBucket === 'Year 1').forEach(r => {
      custY1[r.customer] = (custY1[r.customer] || 0) + r.gt;
    });
    invoices.filter(r => r.yearBucket === 'Year 2').forEach(r => {
      custY2[r.customer] = (custY2[r.customer] || 0) + r.gt;
    });
    const concentration = Object.entries(custY1).sort(([,a],[,b]) => b-a).slice(0,5)
      .map(([customer, y1v]) => {
        const y2v = custY2[customer] || 0;
        const y1Pct = y1v / Math.max(yr1Rev, 1);
        const y2Pct = y2v / Math.max(yr2Rev, 1);
        return {
          customer: customer.length > 22 ? customer.slice(0,22)+'…' : customer,
          y1Rev: Math.round(y1v), y1Pct,
          y2Rev: Math.round(y2v), y2Pct,
          trend: customer.toUpperCase().includes('SKYLINE') ? 'tm-ends'
               : y2v === 0 ? 'neutral'
               : y2Pct > y1Pct + 0.05 ? 'up'
               : y2Pct < y1Pct - 0.05 ? 'down' : 'neutral',
        };
      });

    // New PMs and dealers — Year 1 growth story (3+ quotes, clean)
    const y1PMsByCount = {};
    orders.filter(r => r.yearBucket === 'Year 1' && !r.isInet).forEach(r => {
      if (r.pm) y1PMsByCount[r.pm] = (y1PMsByCount[r.pm] || 0) + 1;
    });
    const preAcqPMs = new Set(
      orders.filter(r => r.yearBucket === 'Pre-acquisition' && !r.isInet && r.pm).map(r => r.pm)
    );
    const newPMsY1 = Object.entries(y1PMsByCount)
      .filter(([pm, c]) => !preAcqPMs.has(pm) && c >= 3).length;

    const y1DealersByCount = {};
    orders.filter(r => r.yearBucket === 'Year 1' && !r.isInet).forEach(r => {
      if (r.customer) y1DealersByCount[r.customer] = (y1DealersByCount[r.customer] || 0) + 1;
    });
    const preAcqDealers = new Set(
      orders.filter(r => r.yearBucket === 'Pre-acquisition' && !r.isInet && r.customer).map(r => r.customer)
    );
    const newDealersY1 = Object.entries(y1DealersByCount)
      .filter(([d, c]) => !preAcqDealers.has(d) && c >= 3).length;

    return {
      // Year context
      yr1Rev, yr2Rev, dayOfYear2, daysRemaining,

      // Year 2 forecast
      forecastBase: Math.round(forecastBase),
      forecastBear: Math.round(forecastBear),
      forecastBull: Math.round(forecastBull),
      committed: Math.round(committed),
      futureBase: Math.round(baseFuture),
      coverageMonths,
      pctOfTarget: forecastBase / 3000000,

      // Composition (for the bar)
      arTotal: Math.round(arTotal), arWeighted,
      flightFace: Math.round(flightFace),
      flightWeighted: Math.round(flightWeighted),
      rtiValue: Math.round(rtiValue),
      backlogFace: Math.round(backlogFace),
      skyline: skylineRemaining,
      pipelineFace: Math.round(pipelineFace),
      pipelineWeighted: Math.round(pipelineWeighted),

      // XL bounty
      xlBounty,
      xlBountyFace: xlBounty.reduce((s,r) => s+r.gt, 0),

      // Momentum — Non-INET
      nonInetQuotes30: nonInetFormal30.length,
      nonInetDollars30: Math.round(nonInetDollars30),
      nonInetCountDelta,
      nonInetDollarDelta,
      nonInetItems30: allQuotes30.filter(q => q.type === 'Non-INET'),
      y1MonthlyNonInetCount: Math.round(y1MonthlyNonInetFormal),
      y1MonthlyNonInetDollars: Math.round(y1MonthlyNonInetDollars),

      // Momentum — INET
      inetQuotes30: inet30.length,
      inetDollars30: Math.round(inetDollars30),
      inetCountDelta,
      inetDollarDelta,
      inetItems30: allQuotes30.filter(q => q.type === 'INET'),
      y1MonthlyInetCount: Math.round(y1MonthlyInetCount),
      y1MonthlyInetDollars: Math.round(y1MonthlyInetDollars),

      // Momentum — Total (for banner logic)
      totalQuotes30, totalQuotesDollars30: Math.round(totalQuotesDollars30),
      totalQuotesDelta,
      totalQuotes30Items: allQuotes30,
      y1MonthlyTotalQuotes: Math.round(y1MonthlyTotalQuotes),
      newPMs30: newPMs30.length,
      newPMs30Items: newPMs30,
      newDealers60: newDealers60.length,
      newDealers60Items: newDealers60,

      // Attention
      attentionList,

      // Concentration & growth story
      concentration,
      newPMsY1, newDealersY1,
    };
  }, [data]);
}

// ─────────────────────────────────────────────────────────────────────────
// usePipelineData — REPLACES the existing usePipelineData function in
// /src/utils/dataHooks.js. Just paste this function over the old one.
//
// Relies on these imports already present in dataHooks.js:
//   - useMemo (React)
//   - TODAY, YEAR2_START constants
//   - parseNum helper
// ─────────────────────────────────────────────────────────────────────────

export function usePipelineData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders, installnet, pm_reviews } = data;

    // ── CURRENT DATE CONTEXT ─────────────────────────────────────────
    const today = new Date(TODAY);
    today.setHours(0, 0, 0, 0);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day this month
    const daysInMonth = currentMonthEnd.getDate();
    const dayOfMonth = today.getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Current quarter bounds
    const currentQ = Math.floor(today.getMonth() / 3);
    const currentQuarterStart = new Date(today.getFullYear(), currentQ * 3, 1);

    // Year 2 start for YTD stats
    const year2Start = new Date(YEAR2_START);

    const parseDate = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d) ? null : d;
    };

    // Helper: figure out "won date" for a won order
    // Priority: approved_start_date → inprog_start_date → most recent status log
    const getWonDate = (r) => {
      return parseDate(r.approved_start_date)
          || parseDate(r.inprog_start_date)
          || parseDate(r.status_log_start_22)
          || parseDate(r.status_log_start_25)
          || null;
    };

    // ── WINS THIS WEEK / MONTH / LAST MONTH ──────────────────────────
    const weekAgo = new Date(today - 7 * 86400000);

    const wonOrders = orders.filter(r => r.isWon && !r.isInet);
    const wonWithDates = wonOrders.map(r => ({ ...r, wonDate: getWonDate(r) }))
                                   .filter(r => r.wonDate);

    const winsThisWeek = wonWithDates.filter(r => r.wonDate >= weekAgo)
                                      .sort((a, b) => b.gt - a.gt);
    const winsThisMonth = wonWithDates.filter(r => r.wonDate >= currentMonthStart);
    const winsLastMonth = wonWithDates.filter(r =>
      r.wonDate >= lastMonthStart && r.wonDate < currentMonthStart
    );

    const winsThisMonthValue = winsThisMonth.reduce((s, r) => s + r.gt, 0);
    const winsLastMonthValue = winsLastMonth.reduce((s, r) => s + r.gt, 0);

    // ── WIN RATE L90d (with breakdown for drill-down) ────────────────
    const cutoff90 = new Date(today - 90 * 86400000);

    // Only count quotes CREATED in last 90 days AND decided (won or lost)
    const decidedL90 = orders.filter(r =>
      !r.isInet && r.isDecided &&
      parseDate(r.created_date) && parseDate(r.created_date) >= cutoff90
    );
    const winsL90 = decidedL90.filter(r => r.isWon);
    const winRateL90Count = decidedL90.length > 0 ? winsL90.length / decidedL90.length : null;
    const winRateL90Dollar = (() => {
      const totalValue = decidedL90.reduce((s, r) => s + r.gt, 0);
      const wonValue = winsL90.reduce((s, r) => s + r.gt, 0);
      return totalValue > 0 ? wonValue / totalValue : null;
    })();

    // Year 1 baseline win rate (count-based, weighted by dollar)
    const y1Decided = orders.filter(r =>
      !r.isInet && r.isDecided && r.yearBucket === 'Year 1'
    );
    const y1Won = y1Decided.filter(r => r.isWon);
    const winRateY1Count = y1Decided.length > 0 ? y1Won.length / y1Decided.length : null;

    // Win rate by PM (L90d, 5+ decided)
    const winRateByPM = (() => {
      const map = {};
      decidedL90.forEach(r => {
        if (!r.pm) return;
        if (!map[r.pm]) map[r.pm] = { decided: 0, won: 0, y1Rate: null };
        map[r.pm].decided++;
        if (r.isWon) map[r.pm].won++;
      });
      // Enrich with Year 1 rate for comparison
      y1Decided.forEach(r => {
        if (!map[r.pm]) return;
        if (!map[r.pm]._y1) map[r.pm]._y1 = { decided: 0, won: 0 };
        map[r.pm]._y1.decided++;
        if (r.isWon) map[r.pm]._y1.won++;
      });
      return Object.entries(map)
        .filter(([, v]) => v.decided >= 3)
        .map(([pm, v]) => ({
          pm,
          decided: v.decided,
          won: v.won,
          rate: v.won / v.decided,
          y1Rate: v._y1 && v._y1.decided >= 5 ? v._y1.won / v._y1.decided : null,
        }))
        .sort((a, b) => b.decided - a.decided);
    })();

    // Win rate by dealer
    const winRateByDealer = (() => {
      const map = {};
      decidedL90.forEach(r => {
        if (!r.customer) return;
        if (!map[r.customer]) map[r.customer] = { decided: 0, won: 0 };
        map[r.customer].decided++;
        if (r.isWon) map[r.customer].won++;
      });
      y1Decided.forEach(r => {
        if (!map[r.customer]) return;
        if (!map[r.customer]._y1) map[r.customer]._y1 = { decided: 0, won: 0 };
        map[r.customer]._y1.decided++;
        if (r.isWon) map[r.customer]._y1.won++;
      });
      return Object.entries(map)
        .filter(([, v]) => v.decided >= 3)
        .map(([customer, v]) => ({
          customer,
          decided: v.decided,
          won: v.won,
          rate: v.won / v.decided,
          y1Rate: v._y1 && v._y1.decided >= 5 ? v._y1.won / v._y1.decided : null,
        }))
        .sort((a, b) => b.decided - a.decided);
    })();

    // Win rate by cohort
    const winRateByCohort = (() => {
      const cohorts = ['XS <$1K', 'S $1K-5K', 'M $5K-15K', 'L $15K-50K', 'XL $50K+'];
      return cohorts.map(c => {
        const l90 = decidedL90.filter(r => r.cohort === c);
        const y1 = y1Decided.filter(r => r.cohort === c);
        const l90Rate = l90.length > 0 ? l90.filter(r => r.isWon).length / l90.length : null;
        const y1Rate = y1.length >= 5 ? y1.filter(r => r.isWon).length / y1.length : null;
        return {
          cohort: c,
          decided: l90.length,
          won: l90.filter(r => r.isWon).length,
          rate: l90Rate,
          y1Rate,
        };
      }).filter(r => r.decided > 0);
    })();

    // ── QUOTE PACE — THIS MONTH (count + value) ─────────────────────
    // "Formal quote" = has lqp_start_date (for non-INET), or any INET record
    const isFormalNonInet = (r) => !r.isInet && !!r.lqp_start_date;

    const formalThisMonth = orders.filter(r => {
      if (!isFormalNonInet(r)) return false;
      const d = parseDate(r.created_date);
      return d && d >= currentMonthStart && d <= today;
    });
    const inetThisMonth = installnet.filter(r => {
      const d = parseDate(r.date_requested);
      return d && d >= currentMonthStart && d <= today;
    });

    const quotesThisMonthCount = formalThisMonth.length + inetThisMonth.length;
    const quotesThisMonthValue = formalThisMonth.reduce((s, r) => s + r.gt, 0)
                               + inetThisMonth.reduce((s, r) => s + r.price, 0);

    // ── TRAILING 3-MONTH AVERAGE ────────────────────────────────────
    // Sum all formal quotes in the last 3 complete months + divide by 3
    // "Last 3 complete months" = 3 months ending at start of current month
    const threeMoStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);

    const formal3mo = orders.filter(r => {
      if (!isFormalNonInet(r)) return false;
      const d = parseDate(r.created_date);
      return d && d >= threeMoStart && d < currentMonthStart;
    });
    const inet3mo = installnet.filter(r => {
      const d = parseDate(r.date_requested);
      return d && d >= threeMoStart && d < currentMonthStart;
    });

    const trailingMo3Count = (formal3mo.length + inet3mo.length) / 3;
    const trailingMo3Value = (
      formal3mo.reduce((s, r) => s + r.gt, 0) +
      inet3mo.reduce((s, r) => s + r.price, 0)
    ) / 3;

    // ── ALL-TIME BEST MONTH (count + value, separately) ──────────────
    // Build month buckets from ALL formal quotes + INET ever
    const monthBuckets = {};
    const bucketKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    orders.filter(isFormalNonInet).forEach(r => {
      const d = parseDate(r.created_date);
      if (!d) return;
      const k = bucketKey(d);
      if (!monthBuckets[k]) monthBuckets[k] = { count: 0, value: 0 };
      monthBuckets[k].count++;
      monthBuckets[k].value += r.gt;
    });
    installnet.forEach(r => {
      const d = parseDate(r.date_requested);
      if (!d) return;
      const k = bucketKey(d);
      if (!monthBuckets[k]) monthBuckets[k] = { count: 0, value: 0 };
      monthBuckets[k].count++;
      monthBuckets[k].value += r.price;
    });

    // Exclude current month from all-time best (it's not complete yet)
    const currentKey = bucketKey(today);
    const completeMonths = Object.entries(monthBuckets).filter(([k]) => k !== currentKey);
    const allTimeBestCount = completeMonths.reduce((m, [, v]) => Math.max(m, v.count), 0);
    const allTimeBestValue = completeMonths.reduce((m, [, v]) => Math.max(m, v.value), 0);

    // ── PROJECTION FOR MONTH-END ─────────────────────────────────────
    // If we're on day 22 of 30, extrapolate to 30
    const projectedMonthEndCount = monthProgress > 0
      ? Math.round(quotesThisMonthCount / monthProgress) : 0;
    const projectedMonthEndValue = monthProgress > 0
      ? Math.round(quotesThisMonthValue / monthProgress) : 0;

    // ── SOURCING: NEW PMs THIS MONTH / NEW DEALERS THIS QUARTER ──────
    // PM first-ever quote seen in our data
    const pmFirstSeen = {};
    orders.forEach(r => {
      if (!r.pm) return;
      const d = parseDate(r.created_date);
      if (!d) return;
      if (!pmFirstSeen[r.pm] || d < pmFirstSeen[r.pm]) pmFirstSeen[r.pm] = d;
    });
    const newPMsThisMonth = Object.entries(pmFirstSeen)
      .filter(([, d]) => d >= currentMonthStart && d <= today)
      .map(([pm, d]) => {
        const rows = orders.filter(r => r.pm === pm);
        return {
          pm,
          dealer: rows[0]?.customer || '',
          firstDate: d.toISOString().slice(0, 10),
          quoteCount: rows.length,
        };
      });
    const newPMsY2YTD = Object.values(pmFirstSeen).filter(d => d >= year2Start && d <= today).length;

    // Dealer first-ever
    const dealerFirstSeen = {};
    orders.forEach(r => {
      if (!r.customer) return;
      const d = parseDate(r.created_date);
      if (!d) return;
      if (!dealerFirstSeen[r.customer] || d < dealerFirstSeen[r.customer]) {
        dealerFirstSeen[r.customer] = d;
      }
    });
    const newDealersThisQ = Object.entries(dealerFirstSeen)
      .filter(([, d]) => d >= currentQuarterStart && d <= today)
      .map(([customer, d]) => {
        const rows = orders.filter(r => r.customer === customer);
        return {
          customer,
          firstDate: d.toISOString().slice(0, 10),
          quoteCount: rows.length,
        };
      });
    const newDealersY2YTD = Object.values(dealerFirstSeen).filter(d => d >= year2Start && d <= today).length;

    // ── MOONSHOTS: open non-INET $50K+ ───────────────────────────────
    const moonshots = orders.filter(r => r.isOpen && !r.isInet && r.gt >= 50000)
      .map(r => ({
        ...r,
        age: r.daysPresented || 0,
      }))
      .sort((a, b) => b.gt - a.gt);

    // ── PM DECISION LAG (per PM, median days quote→decision) ──────────
    // Only for non-INET with lqp_start_date (formal quotes) that were decided
    const pmDecisionLags = {};
    orders.forEach(r => {
      if (r.isInet || !r.pm || !r.isDecided) return;
      const lqp = parseDate(r.lqp_start_date);
      if (!lqp) return;
      let decisionDate = null;
      if (r.isWon) {
        decisionDate = getWonDate(r);
      } else if (r.isLost) {
        decisionDate = parseDate(r.expiry_date) || parseDate(r.status_log_end_21);
      }
      if (!decisionDate || decisionDate < lqp) return;
      const lag = Math.floor((decisionDate - lqp) / 86400000);
      if (lag > 365) return; // exclude outliers
      if (!pmDecisionLags[r.pm]) pmDecisionLags[r.pm] = [];
      pmDecisionLags[r.pm].push(lag);
    });

    const pmMedians = {};
    Object.entries(pmDecisionLags).forEach(([pm, lags]) => {
      if (lags.length < 5) return;
      const sorted = [...lags].sort((a, b) => a - b);
      pmMedians[pm] = sorted[Math.floor(sorted.length / 2)];
    });

    // Overall non-INET median for fallback
    const allLags = Object.values(pmDecisionLags).flat().sort((a, b) => a - b);
    const overallMedian = allLags.length > 0
      ? allLags[Math.floor(allLags.length / 2)]
      : 59;

    // ── PM REVIEW LOG (from Google Form responses, if present) ───────
    // pm_reviews tab shape: [{ pm_name, review_date, notes, timestamp }, ...]
    const reviewLog = {};
    (pm_reviews || []).forEach(r => {
      const pmName = r.pm_name || r.pm;
      const reviewDate = parseDate(r.review_date || r.timestamp);
      if (!pmName || !reviewDate) return;
      if (!reviewLog[pmName] || reviewDate > reviewLog[pmName].date) {
        reviewLog[pmName] = {
          date: reviewDate,
          notes: r.notes || '',
          daysAgo: Math.floor((today - reviewDate) / 86400000),
        };
      }
    });

    // ── PM REVIEW QUEUE ──────────────────────────────────────────────
    // A PM is due for review if ANY of these triggers fire:
    //   1. They have an open L+ quote at age ≥ max(PM_median - 14, 7)
    //   2. They're silent 21+ days AND have open pipeline
    //   3. They have an L+ quote expiring in ≤ 14 days
    // All triggers L+ only ($15K+)

    const openLPlus = orders.filter(r => r.isOpen && !r.isInet && r.gt >= 15000);

    // Last quote date per PM (non-INET)
    const pmLastQuote = {};
    orders.filter(r => !r.isInet && r.pm).forEach(r => {
      const d = parseDate(r.created_date);
      if (!d) return;
      if (!pmLastQuote[r.pm] || d > pmLastQuote[r.pm]) pmLastQuote[r.pm] = d;
    });

    // Group open L+ quotes by PM to build review queue entries
    const pmQueueMap = {};
    openLPlus.forEach(r => {
      if (!r.pm) return;
      if (!pmQueueMap[r.pm]) {
        pmQueueMap[r.pm] = {
          pm: r.pm,
          dealer: r.customer,
          openQuotes: [],
          openValue: 0,
          reasons: [],
        };
      }
      pmQueueMap[r.pm].openQuotes.push(r);
      pmQueueMap[r.pm].openValue += r.gt;
    });

    // Evaluate triggers for each PM
    const reviewQueue = Object.values(pmQueueMap).map(entry => {
      const reasons = [];
      let severity = 'amber'; // default

      // Trigger 1: decision window approaching
      const pmMedian = pmMedians[entry.pm] ?? overallMedian;
      const windowThreshold = Math.max(pmMedian - 14, 7);
      const inWindow = entry.openQuotes.filter(q =>
        (q.daysPresented || 0) >= windowThreshold
      );
      if (inWindow.length > 0) {
        const count = inWindow.length;
        reasons.push(count === 1
          ? `decision window · #${inWindow[0].order_number}`
          : `decision window · ${count} quotes`);
      }

      // Trigger 2: silent 21+ with open pipeline
      const lastQ = pmLastQuote[entry.pm];
      const silentDays = lastQ ? Math.floor((today - lastQ) / 86400000) : null;
      if (silentDays !== null && silentDays >= 21) {
        reasons.push(`silent ${silentDays}d · has open quotes`);
      }

      // Trigger 3: L+ quote expiring in ≤ 14 days
      const expiringSoon = entry.openQuotes.filter(q =>
        q.daysToExpiry !== null && q.daysToExpiry >= 0 && q.daysToExpiry <= 14
      );
      if (expiringSoon.length > 0) {
        const soonest = Math.min(...expiringSoon.map(q => q.daysToExpiry));
        reasons.push(expiringSoon.length === 1
          ? `quote expiring ${soonest}d`
          : `${expiringSoon.length} expiring ≤14d`);
        if (soonest <= 7) severity = 'red';
      }

      // Time since last review (lowers priority if recently reviewed)
      const lastReview = reviewLog[entry.pm];
      const daysSinceReview = lastReview ? lastReview.daysAgo : null;

      return {
        ...entry,
        openCount: entry.openQuotes.length,
        silentDays,
        pmMedian,
        expiringSoon: expiringSoon.length,
        reasons,
        whyReviewing: reasons.join(' · '),
        severity,
        lastReviewDate: lastReview ? lastReview.date.toISOString().slice(0, 10) : null,
        daysSinceReview,
        lastReviewNotes: lastReview?.notes || '',
      };
    }).filter(entry => {
      // If PM was reviewed in last 7 days AND no red triggers, skip
      if (entry.severity !== 'red' && entry.daysSinceReview !== null && entry.daysSinceReview < 7) {
        return false;
      }
      return entry.reasons.length > 0;
    }).sort((a, b) => {
      // Red severity first, then by open value desc
      if (a.severity !== b.severity) return a.severity === 'red' ? -1 : 1;
      return b.openValue - a.openValue;
    });

    // ── RECENTLY EXPIRED L+ (last 45 days, rescue candidates) ────────
    const recentlyExpired = orders.filter(r =>
      r.status === 'Labor Quote Expired' && r.gt >= 15000 &&
      r.daysToExpiry !== null && r.daysToExpiry < 0 && r.daysToExpiry > -45
    ).sort((a, b) => (b.daysToExpiry || 0) - (a.daysToExpiry || 0));

    // ── LARGE OPEN JOBS ($15K-$50K) ──────────────────────────────────
    const largeOpenJobs = orders.filter(r =>
      r.isOpen && !r.isInet && r.gt >= 15000 && r.gt < 50000
    ).map(r => ({
      ...r,
      age: r.daysPresented || 0,
    }));

    return {
      // Date context
      today: today.toISOString().slice(0, 10),
      dayOfMonth,
      daysInMonth,
      monthName: today.toLocaleString('default', { month: 'long' }),
      year: today.getFullYear(),

      // Wins ticker
      winsThisWeek,
      winsThisWeekCount: winsThisWeek.length,
      winsThisWeekValue: Math.round(winsThisWeek.reduce((s, r) => s + r.gt, 0)),

      // Wins this month
      winsThisMonth,
      winsThisMonthCount: winsThisMonth.length,
      winsThisMonthValue: Math.round(winsThisMonthValue),
      winsLastMonthCount: winsLastMonth.length,
      winsLastMonthValue: Math.round(winsLastMonthValue),

      // Win rate
      winRateL90Count,
      winRateL90Dollar,
      winRateY1Count,
      winRateDecidedL90: decidedL90.length,
      winRateWonL90: winsL90.length,
      winRateByPM,
      winRateByDealer,
      winRateByCohort,

      // Sourcing
      newPMsThisMonth,
      newPMsThisMonthCount: newPMsThisMonth.length,
      newPMsY2YTD,
      newDealersThisQ,
      newDealersThisQCount: newDealersThisQ.length,
      newDealersY2YTD,

      // Pace
      quotesThisMonthCount,
      quotesThisMonthValue: Math.round(quotesThisMonthValue),
      trailingMo3Count: Math.round(trailingMo3Count),
      trailingMo3Value: Math.round(trailingMo3Value),
      allTimeBestCount,
      allTimeBestValue: Math.round(allTimeBestValue),
      projectedMonthEndCount,
      projectedMonthEndValue,
      monthProgress,

      // Moonshots
      moonshots,
      moonshotsCount: moonshots.length,
      moonshotsFace: Math.round(moonshots.reduce((s, r) => s + r.gt, 0)),

      // PM review queue
      reviewQueue,
      reviewQueueCount: reviewQueue.length,
      reviewQueueValue: Math.round(reviewQueue.reduce((s, r) => s + r.openValue, 0)),

      // Recently expired
      recentlyExpired,

      // Large open jobs
      largeOpenJobs,
      largeOpenJobsCount: largeOpenJobs.length,
      largeOpenJobsFace: Math.round(largeOpenJobs.reduce((s, r) => s + r.gt, 0)),

      // PM metadata (for the review modal)
      pmMedians,
      overallMedian,
      reviewLog,
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
