import axios, { type AxiosRequestConfig } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

const ACCESS_TOKEN_KEY = "recruitfast_access_token";
const REFRESH_TOKEN_KEY = "recruitfast_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string | null, refreshToken: string | null) {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

function hardLogout() {
  setTokens(null, null);
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

// access_token_expire_minutes is deliberately short (15 min) server-side —
// this is what keeps a session alive past that without forcing a full
// re-login on every 401. Concurrent requests that all 401 at once share
// one in-flight refresh call rather than each racing their own.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error("No refresh token");
      try {
        const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setTokens(data.access_token, data.refresh_token);
        return data.access_token as string;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthEndpoint = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const newAccessToken = await refreshAccessToken();
        original.headers = { ...original.headers, Authorization: `Bearer ${newAccessToken}` };
        return api.request(original);
      } catch {
        hardLogout();
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 401) {
      hardLogout();
    }
    return Promise.reject(error);
  },
);
