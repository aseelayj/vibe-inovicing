import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '@vibe/shared';

type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
    null,
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token')
      || sessionStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    api.post<{ valid: boolean; user: AuthUser }>('/auth/verify')
      .then((res) => {
        setUser(res.user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        setIsAuthenticated(false);
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      const { token, user: u } = await api.post<{
        token: string;
        user: AuthUser;
      }>('/auth/login', { email, password, rememberMe });
      if (rememberMe) {
        localStorage.setItem('token', token);
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', token);
        localStorage.removeItem('token');
      }
      setUser(u);
      setIsAuthenticated(true);
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const isOwner = user?.role === 'owner';

  return { isAuthenticated, user, isOwner, login, logout };
}
