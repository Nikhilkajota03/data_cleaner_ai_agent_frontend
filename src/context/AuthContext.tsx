"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/api";
import type { UserOut } from "@/lib/types";

interface AuthContextType {
  user: UserOut | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<UserOut>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider not initialized");
  },
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from token on initial load
  useEffect(() => {
    const savedToken = getAuthToken();
    if (!savedToken) {
      setLoading(false);
      return;
    }

    setToken(savedToken);
    api
      .me()
      .then((profile) => {
        setUser(profile);
      })
      .catch(() => {
        clearAuthToken();
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<UserOut> => {
    setLoading(true);
    try {
      const res = await api.login(username, password);
      setAuthToken(res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
