const SHEET_ID = '1D-4pHV1dk86I4tgaZJ_9Q0sZeaGODydqUp3itOL1VPI';
const TABS = {
  orders: 'orders',
  invoices: 'paid_invoices',
  installnet: 'installnet',
  contacts: 'contacts',
  prospects: 'prospects',
};

export async function fetchSheet(tabName, accessToken) {
  const range = encodeURIComponent(`${TABS[tabName]}!A:ZZ`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${tabName}: ${res.status}`);
  const data = await res.json();
  const [headers, ...rows] = data.values || [];
  if (!headers) return [];
  return rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null]))
  );
}

export async function fetchAllData(accessToken) {
  const [orders, invoices, installnet, contacts, prospects] = await Promise.all([
    fetchSheet('orders', accessToken),
    fetchSheet('invoices', accessToken),
    fetchSheet('installnet', accessToken),
    fetchSheet('contacts', accessToken),
    fetchSheet('prospects', accessToken),
  ]);
  return { orders, invoices, installnet, contacts, prospects };
}

export function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[,$]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function parseBool(v) {
  if (typeof v === 'boolean') return v;
  return String(v).toUpperCase() === 'TRUE';
}

export function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtCurrency(n, compact = true) {
  if (n === null || n === undefined) return '$0';
  const abs = Math.abs(n);
  if (compact && abs >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (compact && abs >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

export function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

export function today() {
  return new Date();
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
