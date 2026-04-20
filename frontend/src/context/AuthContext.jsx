/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState } from "react";
import api, { TOKEN_STORAGE_KEY, extractApiError } from "../lib/api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(() =>
    Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)),
  );

  const setSession = useCallback((token, nextUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!token) {
      return;
    }

    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const response = await api.get("/auth/me");

        if (!cancelled) {
          setUser(response.data.user);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(
    async ({ email, password }) => {
      const response = await api.post("/auth/login", { email, password });
      const { token, user: nextUser } = response.data;
      setSession(token, nextUser);
      return nextUser;
    },
    [setSession],
  );

  const signup = useCallback(
    async ({ name, email, password }) => {
      const response = await api.post("/auth/signup", { name, email, password });
      const { token, user: nextUser } = response.data;
      setSession(token, nextUser);
      return nextUser;
    },
    [setSession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const updateProfile = useCallback(async ({ name, email }) => {
    const response = await api.patch("/auth/me", { name, email });
    const { user: nextUser } = response.data;
    setUser(nextUser);
    return nextUser;
  }, []);

  const value = {
    user,
    loadingUser,
    isAuthenticated: Boolean(user),
    login,
    signup,
    logout,
    updateProfile,
    extractApiError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
