import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../utils/auth';
import { C } from '../components/UI';

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await profileRes.json();
        const result = login(profile, tokenResponse.access_token);
        if (result.error) {
          setError(result.error);
        }
      } catch (e) {
        setError('Authentication failed. Please try again.');
      }
      setLoading(false);
    },
    onError: () => setError('Google sign-in failed. Please try again.'),
    scope: 'openid email profile https://www.googleapis.com/auth/spreadsheets.readonly',
  });

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        padding: '48px 40px', maxWidth: 400, width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: C.green, margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>P</span>
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 700,
          color: C.text, marginBottom: 6,
        }}>
          Pyramid Office Solutions
        </h1>
        <p style={{
          fontSize: 13, color: C.textSub, marginBottom: 32,
        }}>
          Business Intelligence Dashboard
        </p>

        {error && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.red}`,
            borderRadius: 8, padding: '10px 14px',
            fontSize: 13, color: C.redTxt, marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={() => { setError(null); handleLogin(); }}
          disabled={loading}
          style={{
            width: '100%', padding: '12px 20px',
            background: loading ? '#ccc' : C.text,
            color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 14,
            fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10,
            transition: 'background 0.2s',
          }}
        >
          {loading ? (
            'Signing in...'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.5 2.7 13.5l7.9 6.2C12.4 13.4 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 2.9-2.3 5.3-4.8 7l7.6 5.9c4.4-4.1 7-10.1 7-16.9z"/>
                <path fill="#FBBC05" d="M10.6 28.3c-.6-1.7-.9-3.5-.9-5.3s.3-3.6.9-5.3l-7.9-6.2C1 14.8 0 19.3 0 24s1 9.2 2.7 12.5l7.9-6.2z"/>
                <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.6-5.9c-2.1 1.4-4.8 2.2-7.9 2.2-6.3 0-11.6-3.9-13.4-9.4l-7.9 6.2C6.6 42.5 14.6 48 24 48z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 20 }}>
          Access restricted to authorized Pyramid accounts
        </p>
      </div>
    </div>
  );
}
