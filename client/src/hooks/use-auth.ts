import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    api.post<{ valid: boolean }>('/auth/verify')
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      });
  }, []);

  const login = useCallback(async (password: string) => {
    const { token } = await api.post<{ token: string }>(
      '/auth/login',
      { password },
    );
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, login, logout };
}
