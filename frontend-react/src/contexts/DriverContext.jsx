import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDriverMe } from '../api/driver';

// The signed-in driver's profile (verification, online status, vehicle), shared
// by every driver page so the banner and the toggle agree.
const DriverContext = createContext(null);

export function DriverProvider({ children }) {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => getDriverMe().then((d) => { setMe(d); setError(null); return d; }).catch((e) => setError(e.message)), []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <DriverContext.Provider value={{ me, setMe, error, refresh }}>
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) throw new Error('useDriver must be inside <DriverProvider>');
  return ctx;
}
