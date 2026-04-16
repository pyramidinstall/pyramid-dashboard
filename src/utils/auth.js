import React, { createContext, useContext, useState, useEffect } from 'react';

const ALLOWED_EMAILS = ['jordan@pyramidinstall.com', 'billy@pyramidinstall.com'];
const OWNER_EMAIL = 'jordan@pyramidinstall.com';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('pyr_user');
    const token = sessionStorage.getItem('pyr_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
      setAccessToken(token);
    }
  }, []);

  function login(profile, token) {
    const email = profile.email?.toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      return { error: 'Access denied. Your account is not authorized.' };
    }
    const userData = {
      email,
      name: profile.name,
      picture: profile.picture,
      isOwner: email === OWNER_EMAIL,
    };
    setUser(userData);
    setAccessToken(token);
    sessionStorage.setItem('pyr_user', JSON.stringify(userData));
    sessionStorage.setItem('pyr_token', token);
    return { success: true };
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    sessionStorage.removeItem('pyr_user');
    sessionStorage.removeItem('pyr_token');
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
