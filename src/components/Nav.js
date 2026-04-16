import React from 'react';
import { useAuth } from '../utils/auth';
import { C } from './UI';

const OWNER_PAGES = [
  { id: 'overview',      label: 'Overview' },
  { id: 'pipeline',      label: 'Pipeline' },
  { id: 'backlog',       label: 'Backlog' },
  { id: 'installnet',    label: 'INSTALL Net' },
  { id: 'relationships', label: 'Relationships' },
];

const BILLY_PAGES = [
  { id: 'pipeline',      label: 'Pipeline' },
  { id: 'backlog',       label: 'Backlog' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'commission',    label: 'My Commission' },
];

export default function Nav({ activePage, setActivePage, lastRefresh, onRefresh, loading }) {
  const { user, logout } = useAuth();
  const pages = user?.isOwner ? OWNER_PAGES : BILLY_PAGES;

  return (
    <nav style={{
      background: C.navy, color: '#fff',
      padding: '0 24px',
      display: 'flex', alignItems: 'center',
      height: 52, gap: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginRight: 32, flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: C.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#fff',
        }}>P</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
          Pyramid
        </span>
        {!user?.isOwner && (
          <span style={{
            fontSize: 10, background: C.blue,
            color: '#fff', padding: '1px 6px',
            borderRadius: 4, fontWeight: 600,
          }}>TEAM</span>
        )}
      </div>

      {/* Pages */}
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {pages.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePage(p.id)}
            style={{
              background: activePage === p.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: 'none', color: activePage === p.id ? '#fff' : 'rgba(255,255,255,0.6)',
              padding: '6px 14px', borderRadius: 6,
              fontSize: 13, cursor: 'pointer',
              fontWeight: activePage === p.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.target.style.color = '#fff'}
            onMouseLeave={e => {
              if (activePage !== p.id) e.target.style.color = 'rgba(255,255,255,0.6)';
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {lastRefresh && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Updated {lastRefresh}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            color: '#fff', padding: '5px 10px', borderRadius: 6,
            fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          ↻
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {user?.picture && (
            <img
              src={user.picture} alt={user.name}
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            />
          )}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {user?.name?.split(' ')[0]}
          </span>
          <button
            onClick={logout}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.6)', padding: '4px 8px',
              borderRadius: 4, fontSize: 11, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
