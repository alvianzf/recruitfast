import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastProvider";
import { buildTheme } from "./theme";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default staleTime is 0, which refetches every query on every
      // component mount and window focus — most of this app's data
      // (jobs, candidates, clients, teams, org profile) doesn't change
      // second-to-second, and every mutation hook already calls
      // invalidateQueries on the relevant key, so this doesn't trade away
      // freshness where it actually matters, just the redundant refetch
      // of data that hasn't changed.
      staleTime: 30_000,
    },
  },
});

function Root() {
  // Deliberately NOT following prefers-color-scheme — the off-white
  // background/theme is the product's actual default look, not something
  // that should silently flip to the dark gradient just because the OS
  // is set to dark mode. There's no in-app toggle yet either, so this was
  // previously a trap: a user on a dark-mode OS could never see the
  // intended off-white design at all. See docs/06-ui-design-system.md.
  const [mode] = useState<"light" | "dark">("light");
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className={`app-background ${mode}`} />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
