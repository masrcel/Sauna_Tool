import { User } from '../types';
import { api } from '../lib/api';
import { setToken, clearToken, getStoredUser, setStoredUser, clearUser, subscribeUser } from '../lib/auth';
import { useState, useCallback, useSyncExternalStore } from 'react';

export function useAuth() {
  const user = useSyncExternalStore(subscribeUser, getStoredUser);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setStoredUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearUser();
  }, []);

  /** Lädt Name, Rolle und Foto neu vom Server (z. B. nach Rollenänderung). */
  const refresh = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    if (data) setStoredUser({ ...(getStoredUser() ?? {}), ...data } as User);
  }, []);

  const isAdmin = user?.role === 'admin';
  return { user, isAdmin, loading, login, logout, refresh };
}
