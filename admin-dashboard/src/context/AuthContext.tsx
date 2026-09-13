import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: any | null;
  role: string | null;
  login: (token: string, refreshToken: string, user: any, role: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mess_admin_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem('mess_admin_refresh_token')
  );
  const [user, setUser] = useState<any>(() => {
    const u = localStorage.getItem('mess_admin_user');
    return u ? JSON.parse(u) : null;
  });
  const [role, setRole] = useState<string | null>(() => localStorage.getItem('mess_admin_role'));

  function login(newToken: string, newRefreshToken: string, newUser: any, newRole: string) {
    localStorage.setItem('mess_admin_token', newToken);
    if (newRefreshToken) localStorage.setItem('mess_admin_refresh_token', newRefreshToken);
    localStorage.setItem('mess_admin_user', JSON.stringify(newUser));
    localStorage.setItem('mess_admin_role', newRole);
    setToken(newToken);
    setRefreshToken(newRefreshToken);
    setUser(newUser);
    setRole(newRole);
  }

  function logout() {
    localStorage.removeItem('mess_admin_token');
    localStorage.removeItem('mess_admin_refresh_token');
    localStorage.removeItem('mess_admin_user');
    localStorage.removeItem('mess_admin_role');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ token, refreshToken, user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
