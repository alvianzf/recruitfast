import { createTheme, type PaletteMode } from "@mui/material";

// Design system — see docs/13-redesign.md for the full rationale. Three
// deliberate layers: a blue "ink" primary ramp (unchanged brand hue, now
// with real depth), a warm "Ember" secondary used sparingly as a genuine
// accent (not a background color), and a status-color family shared by
// every chip/chart/kanban-accent in the app so "won" and "open" are never
// visually confusable and a color never means two different things.

export const BRAND_PRIMARY = "#3D6B94"; // primary.500 — light mode main
export const BRAND_PRIMARY_LIGHT = "#7CA8CC"; // primary.300 — dark mode main
export const BRAND_PRIMARY_DARK = "#244B6B"; // primary.700 — hover/headline ink
export const BRAND_PRIMARY_DEEP = "#142E42"; // primary.900 — near-navy, footer/dark chrome

export const BRAND_ACCENT = "#D1653A"; // Ember — candidate-facing CTAs, one highlighted word
export const BRAND_ACCENT_LIGHT = "#E58F6B";
export const BRAND_ACCENT_DARK = "#A84D28";

export const OFF_WHITE = "#f7f5f2";

// Ink/neutral ramp — replaces flat text.primary/secondary with a real
// hierarchy. INK.tertiary is for metadata/timestamps that shouldn't
// compete with body copy at the same weight.
export const INK = {
  light: { 900: "#0F2233", 700: "#33495B", 500: "#64798C", 300: "#A8B7C2", 100: "#E3E9ED" },
  dark: { 50: "#EDF2F6", 200: "#C3D0DA", 400: "#8497A6", 600: "#4A5C6C", 800: "#1B2C3A" },
};

// One hue-consistent status family — deliberately not stock MUI
// red/green/orange. `won` is violet, not green, specifically so a
// successfully-closed job is never visually confused with an actively
// hiring one. `active`/`rejected` placement statuses reuse `open`/`lost`
// (same semantic — in motion vs. ended badly) rather than getting their
// own hues. Used via getStatusColor() everywhere a status renders:
// job status chips, placement status chips, Kanban stage accents, and
// Dashboard chart series all pull from this one map.
export const STATUS_COLORS = {
  open: { main: "#1F8A6E", dark: "#4FBFA0" },
  on_hold: { main: "#B8791A", dark: "#E0A94A" },
  won: { main: "#6D4AAF", dark: "#A587D9" },
  lost: { main: "#B23A2E", dark: "#E07A6C" },
  withdrawn: { main: "#6B7785", dark: "#9AA7B3" },
  active: { main: "#1F8A6E", dark: "#4FBFA0" },
  rejected: { main: "#B23A2E", dark: "#E07A6C" },
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export function getStatusColor(status: string, mode: PaletteMode = "light"): string {
  const entry = STATUS_COLORS[status as StatusKey];
  if (!entry) return mode === "dark" ? INK.dark[400] : INK.light[500];
  return mode === "dark" ? entry.dark : entry.main;
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function buildTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? BRAND_PRIMARY_LIGHT : BRAND_PRIMARY,
        dark: isDark ? BRAND_PRIMARY : BRAND_PRIMARY_DARK,
        contrastText: "#ffffff",
      },
      secondary: {
        main: BRAND_ACCENT,
        light: BRAND_ACCENT_LIGHT,
        dark: BRAND_ACCENT_DARK,
        contrastText: "#ffffff",
      },
      background: {
        // MUI's color utilities (alpha/darken/lighten — used internally by
        // DataGrid and others) can't parse the CSS keyword "transparent",
        // only actual color-function formats. rgba(...) with 0 alpha is
        // visually identical and parses fine. The visible background is
        // the off-white .app-background gradient in index.css.
        default: "rgba(0,0,0,0)",
        paper: isDark ? "#12202E" : "#ffffff",
      },
      text: {
        primary: isDark ? INK.dark[50] : INK.light[900],
        secondary: isDark ? INK.dark[200] : INK.light[700],
      },
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,40,60,0.08)",
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"InterVariable", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontFamily: '"Space Grotesk Variable", "Space Grotesk", sans-serif',
        fontWeight: 700,
        fontSize: "3.5rem",
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
      },
      h2: {
        fontFamily: '"Space Grotesk Variable", "Space Grotesk", sans-serif',
        fontWeight: 700,
        fontSize: "2.75rem",
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
      },
      h3: {
        fontFamily: '"Space Grotesk Variable", "Space Grotesk", sans-serif',
        fontWeight: 600,
        fontSize: "2rem",
        lineHeight: 1.15,
        letterSpacing: "-0.01em",
      },
      h4: { fontWeight: 700, fontSize: "1.5rem", lineHeight: 1.25, letterSpacing: "-0.01em" },
      h5: { fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.3, letterSpacing: "-0.005em" },
      h6: { fontWeight: 600, fontSize: "1.0625rem", lineHeight: 1.35 },
      subtitle1: { fontWeight: 600, fontSize: "1rem", lineHeight: 1.4 },
      subtitle2: { fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.4 },
      body1: { fontWeight: 400, fontSize: "1rem", lineHeight: 1.55 },
      body2: { fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.5 },
      caption: { fontWeight: 500, fontSize: "0.75rem", lineHeight: 1.4, letterSpacing: "0.01em" },
      overline: {
        fontWeight: 700,
        fontSize: "0.6875rem",
        lineHeight: 1.4,
        letterSpacing: "0.08em",
      },
      button: { fontWeight: 600, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: "transparent",
          },
        },
      },
      // Flat, bordered "resting card" is the default surface now — glass
      // is a deliberate signature treatment applied explicitly (via sx)
      // on just the AppShell sidebar rail and the Landing hero/nav, the
      // two places the colorful gradient mesh actually sits behind it.
      // Everywhere else (dense tables, dashboard panels, dialogs) reads
      // better flat, which is why the old glass-by-default required
      // opting back out in a dozen places — see docs/13-redesign.md.
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor:
              theme.palette.mode === "dark" ? "rgba(10, 20, 32, 0.6)" : "rgba(255, 255, 255, 0.6)",
            backdropFilter: "blur(24px) saturate(140%)",
            boxShadow: "none",
            borderRight: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 100,
            paddingInline: 20,
          },
          contained: ({ theme }) => ({
            boxShadow: "none",
            "&:hover": {
              boxShadow: `0 8px 20px -6px ${theme.palette.primary.main}66`,
            },
          }),
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&:hover": {
              backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : `${INK.light[100]}80`,
            },
          }),
        },
      },
    },
  });
}
