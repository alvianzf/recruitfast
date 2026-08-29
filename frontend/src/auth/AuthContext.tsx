import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, getAccessToken, getRefreshToken, setTokens } from "../api/client";

interface JwtClaims {
  sub: string;
  tenant_id: string | null;
  role: "superadmin" | "org_admin" | "recruiter";
  exp: number;
}

interface AuthUser {
  id: string;
  tenantId: string | null;
  role: JwtClaims["role"];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const claims = decodeClaims(token);
  if (!claims) return null;
  if (claims.exp * 1000 < Date.now()) return null;
  return { id: claims.sub, tenantId: claims.tenant_id, role: claims.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => userFromToken(getAccessToken()));
  // The access token is short-lived (15 min) by design; on a fresh page
  // load it may have already expired while a still-valid refresh token
  // sits in storage. Without this, every reload past 15 minutes would
  // bounce a genuinely-still-logged-in user to /login.
  const [loading, setLoading] = useState(() => !userFromToken(getAccessToken()) && !!getRefreshToken());

  useEffect(() => {
    if (!loading) return;
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      setLoading(false);
      return;
    }
    api
      .post("/auth/refresh", { refresh_token: refreshToken })
      .then(({ data }) => {
        setTokens(data.access_token, data.refresh_token);
        setUser(userFromToken(data.access_token));
      })
      .catch(() => {
        setTokens(null, null);
        setUser(null);
      })
      .finally(() => setLoading(false));
    // Runs once on mount — this is a one-shot boot-time recovery, not a
    // reaction to `loading` changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const { data } = await api.post("/auth/login", { email, password });
        setTokens(data.access_token, data.refresh_token);
        setUser(userFromToken(data.access_token));
      },
      logout() {
        setTokens(null, null);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
