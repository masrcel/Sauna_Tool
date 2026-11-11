import { User } from '../types';
import { api } from '../lib/api';
import { setToken, clearToken, getStoredUser, setStoredUser, clearUser } from '../lib/auth';
import { useState, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setStoredUser(data.user);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearUser();
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
