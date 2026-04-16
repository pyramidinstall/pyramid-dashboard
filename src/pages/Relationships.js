import React, { useState } from 'react';
import { Card, CardTitle, SectionLabel, Grid, Badge, Table, Alert, C } from '../components/UI';
import { useRelationshipData } from '../utils/dataHooks';
import { parseNum } from '../utils/sheets';

export default function Relationships({ data, isOwner }) {
  const d = useRelationshipData(data);
  const [selectedCompany, setSelectedCompany] = useState(null);

  if (!d) return null;

  // Get quote history for selected company
  const companyQuotes = selectedCompany
    ? data.orders
        .filter(r => r.customer === selectedCompany && ['Year 1','Year 2'].includes(r.year_bucket))
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 20)
    : [];

  const STATUS_BADGE = {
    'Going cold': 'red', 'Rebuilding': 'amber',
    'Reactivation target': 'purple', 'Active': 'green',
    'Prospect': 'blue',
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1320, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        Relationship Health
      </h2>
      <p style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>
        Click any company to see their quote history
      </p>

      {d.goingCold.length > 0 && (
        <Alert type="amber">
          <strong>{d.goingCold.length} relationships going cold.</strong>{' '}
          {d.goingCold.slice(0, 3).map(r => r.company).join(', ')}
          {d.goingCold.length > 3 ? ` and ${d.goingCold.length - 3} more` : ''} — last quote over 21 days ago.
        </Alert>
      )}

      <Grid cols={3} gap={10} style={{ marginBottom: 16 }}>
        {/* Going cold */}
        <Card>
          <CardTitle>Going cold</CardTitle>
          <Table
            cols={[
              { key: 'company', label: 'Dealer', width: '52%' },
              { key: 'days_since_last_quote', label: 'Last quote', width: '28%',
                render: v => {
                  const n = parseNum(v);
                  return <Badge type={n > 180 ? 'red' : n > 60 ? 'red' : 'amber'}>{n}d ago</Badge>;
                }},
              { key: 'post_acq_quotes', label: 'Quotes', width: '20%' },
            ]}
            rows={d.goingCold}
            onRowClick={r => setSelectedCompany(r.company)}
          />
        </Card>

        {/* Rebuilding */}
        <Card>
          <CardTitle>Relationship rebuilding</CardTitle>
          <Table
            cols={[
              { key: 'company', label: 'Dealer', width: '50%' },
              { key: 'pre_acq_quotes', label: 'Pre-acq', width: '25%' },
              { key: 'post_acq_quotes', label: 'Post-acq', width: '25%' },
            ]}
            rows={d.rebuilding}
            onRowClick={r => setSelectedCompany(r.company)}
          />
          <div style={{
            background: '#f5f6f8', borderRadius: 8, padding: '8px 10px',
            fontSize: 11, color: C.textSub, marginTop: 8,
          }}>
            Volume dropped at acquisition. Active outreach needed.
          </div>
        </Card>

        {/* Reactivation + Prospects */}
        <Card>
          <CardTitle>Reactivation &amp; prospects</CardTitle>
          <Table
            cols={[
              { key: 'company', label: 'Company', width: '50%' },
              { key: 'type', label: 'Type', width: '25%',
                render: (v, row) => (
                  <Badge type={row.stage ? 'blue' : 'purple'}>
                    {row.stage ? 'Prospect' : 'Reactivate'}
                  </Badge>
                )},
              { key: 'stage', label: 'Stage', width: '25%',
                render: v => v ? <Badge type="amber">{v}</Badge> : <Badge type="amber">Outreach</Badge> },
            ]}
            rows={[
              ...d.reactivation.map(r => ({ ...r, type: 'reactivate' })),
              ...d.prospectList.map(r => ({ ...r, company: r.company, type: 'prospect' })),
            ]}
            onRowClick={r => r.type === 'reactivate' && setSelectedCompany(r.company)}
          />
          {isOwner && (
            <div style={{
              background: '#f5f6f8', borderRadius: 8, padding: '8px 10px',
              fontSize: 11, color: C.textSub, marginTop: 8,
            }}>
              Add prospects directly in the Google Sheet → prospects tab.
            </div>
          )}
        </Card>
      </Grid>

      {/* Full relationship list */}
      <SectionLabel>All relationships — post-acquisition activity</SectionLabel>
      <Card>
        <Table
          cols={[
            { key: 'company', label: 'Company', width: '30%' },
            { key: 'company_category', label: 'Category', width: '14%',
              render: v => v ? <Badge type="gray">{v}</Badge> : '—' },
            { key: 'relationship_status', label: 'Status', width: '16%',
              render: v => <Badge type={STATUS_BADGE[v] || 'gray'}>{v}</Badge> },
            { key: 'post_acq_quotes', label: 'Post-acq quotes', width: '14%' },
            { key: 'pre_acq_quotes', label: 'Pre-acq quotes', width: '14%' },
            { key: 'days_since_last_quote', label: 'Days since last', width: '12%',
              render: v => v ? `${v}d` : '—' },
          ]}
          rows={[...data.contacts].sort((a, b) =>
            parseNum(b.post_acq_quotes) - parseNum(a.post_acq_quotes))}
          onRowClick={r => setSelectedCompany(r.company)}
        />
      </Card>

      {/* Company drill-down modal */}
      {selectedCompany && (
        <div
          onClick={() => setSelectedCompany(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              padding: 24, maxWidth: 600, width: '90%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                {selectedCompany}
              </h3>
              <button onClick={() => setSelectedCompany(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: C.textMuted }}>
                ×
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>
              Recent quote history (last 20)
            </div>
            <Table
              cols={[
                { key: 'order_number', label: '#', width: '12%' },
                { key: 'created_date', label: 'Date', width: '18%' },
                { key: 'pm', label: 'PM', width: '22%' },
                { key: 'grand_total', label: 'Value', width: '16%',
                  render: v => `$${Math.round(parseNum(v)).toLocaleString()}` },
                { key: 'status', label: 'Status', width: '32%',
                  render: v => {
                    const won = ['Invoiced','Installation Complete','In-Progress','Approved Order',
                      'Ready to Invoice','In-Progress - Phase Break','Implementation Complete'].includes(v);
                    const lost = ['Labor Quote Expired','Labor Quote Not Used'].includes(v);
                    return <Badge type={won ? 'green' : lost ? 'red' : 'gray'}>
                      {v?.replace('Labor Quote ','').replace('Installation Complete','Complete')}
                    </Badge>;
                  }},
              ]}
              rows={companyQuotes}
            />
            {companyQuotes.length === 0 && (
              <p style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>
                No post-acquisition quotes found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
