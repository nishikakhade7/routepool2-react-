import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rp_token';
const USER_KEY  = 'rp_user';
// 'customer' | 'driver'. Sessions saved before roles existed are customers.
const ROLE_KEY  = 'rp_role';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]  = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [storedRole, setStoredRole] = useState(() => localStorage.getItem(ROLE_KEY) || 'customer');

  const login = useCallback(({ token: t, user: u }, r = 'customer') => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem(ROLE_KEY, r);
    setToken(t);
    setUser(u);
    setStoredRole(r);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setUser(null);
    setStoredRole('customer');
  }, []);

  // Staff use the customer app plus the Admin tab, so 'admin' is a customer with isAdmin.
  const role = !token ? null : storedRole === 'driver' ? 'driver' : user?.isAdmin ? 'admin' : 'customer';

  return (
    <AuthContext.Provider value={{ token, user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
