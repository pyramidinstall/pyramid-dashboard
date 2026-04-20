import React, { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './utils/auth';
import { fetchAllData } from './utils/sheets';
import { useEnrichedData, debugData } from './utils/dataHooks';
import { Spinner } from './components/UI';
import Nav from './components/Nav';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Pipeline from './pages/Pipeline';
import Backlog from './pages/Backlog';
import DealerRelationships from './pages/DealerRelationships';
import InstallNet from './pages/InstallNet';
import Relationships from './pages/Relationships';

const CLIENT_ID = '161922713447-e3lu6l1bbihuj0ru3b28bdothktvjplj.apps.googleusercontent.com';

function Dashboard() {
  const { user, accessToken } = useAuth();
  const [activePage, setActivePage] = useState(user?.isOwner ? 'overview' : 'pipeline');
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError(null);
    try {
      const d = await fetchAllData(accessToken);
      setRawData(d);
      setLastRefresh(new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }));
      console.log('Raw data loaded:', debugData(d));
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { loadData(); }, [loadData]);

  // Enrich raw data — all algorithm runs here
  const data = useEnrichedData(rawData);

  if (!user) return <Login />;
  if (loading && !data) return <Spinner />;
  if (error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}>
      <div style={{fontSize:16,color:'#E24B4A'}}>Failed to load data</div>
      <div style={{fontSize:13,color:'#888'}}>{error}</div>
      <button onClick={loadData} style={{padding:'8px 20px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14}}>Retry</button>
    </div>
  );

  const pages = {
    overview:      <Overview data={data} />,
    pipeline:      <Pipeline data={data} />,
    backlog:       <Backlog data={data} />,
    dealers:       <DealerRelationships data={data} />,
    installnet:    <InstallNet data={data} />,
    relationships: <Relationships data={data} isOwner={user?.isOwner} />,
  };

  return (
    <div style={{minHeight:'100vh',background:'#f5f6f8'}}>
      <Nav activePage={activePage} setActivePage={setActivePage}
        lastRefresh={lastRefresh} onRefresh={loadData} loading={loading} />
      <main>{pages[activePage] || pages['pipeline']}</main>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AuthProvider><Dashboard /></AuthProvider>
    </GoogleOAuthProvider>
  );
}
