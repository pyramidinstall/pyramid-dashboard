import { useMemo } from 'react';
import { parseNum, parseBool, fmtCurrency } from '../utils/sheets';

const JORDAN_START = new Date('2025-04-01');
const YEAR2_START  = new Date('2026-04-01');
const TODAY        = new Date('2026-04-08');

export function useOverviewData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { invoices, orders } = data;

    // Revenue by year
    const yr1Rev = invoices
      .filter(r => r.year_bucket === 'Year 1')
      .reduce((s, r) => s + parseNum(r.grand_total), 0);
    const yr2Rev = invoices
      .filter(r => r.year_bucket === 'Year 2')
      .reduce((s, r) => s + parseNum(r.grand_total), 0);

    // Monthly revenue Year 1
    const monthlyMap = {};
    invoices.filter(r => r.year_bucket === 'Year 1').forEach(r => {
      const m = r.month || '';
      if (m) monthlyMap[m] = (monthlyMap[m] || 0) + parseNum(r.grand_total);
    });
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({
        month: month.slice(5), // MM
        label: new Date(month + '-01').toLocaleString('default', { month: 'short' }),
        revenue,
      }));

    // Concentration
    const custMap = {};
    invoices.filter(r => r.year_bucket === 'Year 1').forEach(r => {
      const c = r.customer || 'Unknown';
      custMap[c] = (custMap[c] || 0) + parseNum(r.grand_total);
    });
    const concentration = Object.entries(custMap)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 11)
      .map(([customer, revenue]) => ({
        customer: customer.length > 20 ? customer.slice(0, 20) + '…' : customer,
        revenue, pct: revenue / yr1Rev,
      }));

    // Pipeline funnels
    const openOrders = orders.filter(r => parseBool(r.is_open_quote));
    const pipelineFace = openOrders.reduce((s, r) => s + parseNum(r.grand_total), 0);
    const pipelineWeighted = openOrders.reduce((s, r) => s + parseNum(r.weighted_backlog || 0), 0);

    // Backlog
    const backlogOrders = orders.filter(r => parseBool(r.is_backlog));
    const backlogFace = backlogOrders.reduce((s, r) => s + parseNum(r.remaining_to_invoice || r.grand_total), 0);
    const backlogWeighted = backlogOrders.reduce((s, r) => s + parseNum(r.weighted_backlog || 0), 0);

    // Backlog by tier
    const tierMap = { Imminent: 0, 'On track': 0, 'Slight delay': 0, 'Check in': 0, 'Follow up': 0 };
    backlogOrders.forEach(r => {
      const tier = r.backlog_conf_tier;
      const val = parseNum(r.remaining_to_invoice || r.grand_total);
      if (tier in tierMap) tierMap[tier] += val;
    });

    return {
      yr1Rev, yr2Rev, monthly, concentration,
      pipelineFace, pipelineWeighted,
      backlogFace, backlogWeighted, tierMap,
      totalForwardFace: pipelineFace + backlogFace,
      totalForwardWeighted: pipelineWeighted + backlogWeighted,
    };
  }, [data]);
}

export function usePipelineData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders } = data;
    const open = orders.filter(r => parseBool(r.is_open_quote));

    // By cohort
    const cohorts = ['XS <$1K','S $1K-5K','M $5K-15K','L $15K-50K','XL $50K+'];
    const byCohort = cohorts.map(c => {
      const rows = open.filter(r => r.cohort === c);
      return {
        cohort: c,
        count: rows.length,
        face: rows.reduce((s, r) => s + parseNum(r.grand_total), 0),
        weighted: rows.reduce((s, r) => s + parseNum(r.weighted_backlog || 0), 0),
      };
    });

    // Expiry alerts L+
    const expiryAlerts = orders
      .filter(r => r.expiry_alert)
      .sort((a, b) => parseNum(a.days_to_expiry) - parseNum(b.days_to_expiry));

    // Recently expired L+
    const recentlyExpired = orders
      .filter(r => r.status === 'Labor Quote Expired' && parseNum(r.grand_total) >= 15000)
      .filter(r => {
        const d = parseNum(r.days_to_expiry);
        return d < 0 && d > -90;
      })
      .sort((a, b) => parseNum(b.days_to_expiry) - parseNum(a.days_to_expiry));

    // Large job nurture table ($25K+)
    const nurture = open
      .filter(r => parseNum(r.grand_total) >= 25000)
      .sort((a, b) => parseNum(b.grand_total) - parseNum(a.grand_total));

    // All open quotes for drill-down
    const allOpen = open.sort((a, b) => parseNum(b.grand_total) - parseNum(a.grand_total));

    return { byCohort, expiryAlerts, recentlyExpired, nurture, allOpen };
  }, [data]);
}

export function useBacklogData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders } = data;
    const backlog = orders.filter(r => parseBool(r.is_backlog));

    // Check-in alerts (90d+)
    const alerts = backlog
      .filter(r => ['Check in','Follow up'].includes(r.backlog_conf_tier))
      .sort((a, b) => parseNum(b.days_in_status) - parseNum(a.days_in_status));

    // By tier for donut
    const tiers = ['Imminent','On track','Slight delay','Check in','Follow up'];
    const byTier = tiers.map(t => ({
      tier: t,
      value: backlog
        .filter(r => r.backlog_conf_tier === t)
        .reduce((s, r) => s + parseNum(r.remaining_to_invoice || r.grand_total), 0),
    }));

    return { backlog, alerts, byTier };
  }, [data]);
}

export function useCloseRateData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { orders, installnet } = data;

    const quarters = ['2025Q2','2025Q3','2025Q4','2026Q1','2026Q2'];
    const postOrders = orders.filter(r =>
      ['Year 1','Year 2'].includes(r.year_bucket) && !parseBool(r.is_open_quote ||
      r.channel === 'INSTALL Net'));

    function qCR(rows, qFilter) {
      const q = qFilter ? rows.filter(r => r.quarter === qFilter) : rows;
      const decided = q.filter(r => parseBool(r.is_decided));
      const won = decided.filter(r => parseBool(r.is_won));
      return decided.length >= 3 ? won.length / decided.length : null;
    }

    // Key IQ PMs
    const iqPMs = [
      { dealer: 'HUDSON River Moving & Storage, LLC', pm: 'Evan Eisner', label: 'Hudson / Eisner' },
      { dealer: 'SYSTEMS Source', pm: 'Gerald Pastor', label: 'Systems / Pastor' },
      { dealer: 'BENHAR Office Interiors', pm: 'Jim Huang', label: 'BENHAR / Huang' },
      { dealer: 'BFI New Jersey', pm: "Mark O'Connor", label: "BFI / O'Connor" },
      { dealer: 'OFFICE Works, Inc', pm: 'Edwina Smollen', label: 'OFC Works / Smollen' },
      { dealer: 'THE Whalen Berez Group, LLC', pm: 'Geni Derusso', label: 'Whalen / DeRusso' },
      { dealer: 'AFD Contract Furniture', pm: 'Matt Dean', label: 'AFD / Dean' },
    ];

    const iqPMRates = iqPMs.map(({ dealer, pm, label }) => {
      const rows = postOrders.filter(r => r.customer === dealer && r.pm === pm);
      const overall = qCR(rows, null);
      const byQ = quarters.map(q => qCR(rows, q));
      return { label, overall, byQ };
    });

    // INET PMs
    const inetPMs = [
      'Emma Ziegler','Deshope Doherty','Jenn Simpson (arc)','Mitch Woody',
      'Robbie Haridin','Stacey Lynn Hook','Laurie Gay','Sade Ford',
      'Kelli French','Diane Ginnity','Gretchen Phipps',
    ];

    function inetQCR(rows, qFilter) {
      const q = qFilter ? rows.filter(r => r.quarter === qFilter) : rows;
      const decided = q.filter(r => parseBool(r.decided));
      const won = decided.filter(r => parseBool(r.won));
      return decided.length >= 3 ? won.length / decided.length : null;
    }

    const inetPMRates = inetPMs.map(pm => {
      const rows = installnet.filter(r =>
        r.pm === pm && ['Year 1','Year 2'].includes(r.year_bucket));
      const decided = rows.filter(r => parseBool(r.decided));
      const won = rows.filter(r => parseBool(r.won));
      const passed = rows.filter(r => parseBool(r.passed));
      const overall = decided.length >= 3 ? won.length / decided.length : null;
      const byQ = quarters.map(q => inetQCR(rows, q));
      const revenue = won.reduce((s, r) => s + parseNum(r.installation_price), 0);
      // No-bid counts by quarter
      const noBidByQ = quarters.map(q =>
        rows.filter(r => r.quarter === q && parseBool(r.passed)).length
      );
      return { pm, overall, byQ, revenue, decided: decided.length, passed: passed.length, noBidByQ };
    });

    return { iqPMRates, inetPMRates, quarters };
  }, [data]);
}

export function useRelationshipData(data) {
  return useMemo(() => {
    if (!data) return null;
    const { contacts, prospects } = data;

    const goingCold = contacts.filter(r => r.relationship_status === 'Going cold')
      .sort((a, b) => parseNum(b.days_since_last_quote) - parseNum(a.days_since_last_quote));
    const rebuilding = contacts.filter(r => r.relationship_status === 'Rebuilding');
    const reactivation = contacts.filter(r => r.relationship_status === 'Reactivation target');
    const prospectList = prospects || [];

    return { goingCold, rebuilding, reactivation, prospectList };
  }, [data]);
}
