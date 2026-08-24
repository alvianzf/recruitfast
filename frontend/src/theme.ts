import { createTheme, type PaletteMode } from "@mui/material";

// Brand primary + Material Design 3-flavored shape/elevation tokens.
// Every Paper (cards, modals, panels) gets the glass treatment by default,
// floating over the fixed gradient mesh in index.css (.app-background) —
// glassmorphism needs a colorful backdrop to actually read as "glass".
// Dense data tables opt back out on the specific instance
// (sx={{ backdropFilter: "none", backgroundColor: "background.paper" }}).
// See docs/06-ui-design-system.md.
export const BRAND_PRIMARY = "#990000";
export const BRAND_PRIMARY_LIGHT = "#c62a2a";

export function buildTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? BRAND_PRIMARY_LIGHT : BRAND_PRIMARY,
        contrastText: "#ffffff",
      },
      secondary: {
        main: isDark ? "#ffb199" : "#7a1f1f",
      },
      background: {
        // MUI's color utilities (alpha/darken/lighten — used internally by
        // DataGrid and others) can't parse the CSS keyword "transparent",
        // only actual color-function formats. rgba(...) with 0 alpha is
        // visually identical and parses fine.
        default: "rgba(0,0,0,0)",
        paper: isDark ? "#241019" : "#ffffff",
      },
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(60,10,20,0.08)",
    },
    shape: {
      borderRadius: 20,
    },
    typography: {
      fontFamily: '"InterVariable", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700, letterSpacing: -0.5 },
      h5: { fontWeight: 700, letterSpacing: -0.3 },
      h6: { fontWeight: 700 },
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
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            ...(theme.palette.mode === "dark"
              ? {
                  backgroundColor: "rgba(36, 16, 25, 0.72)",
                  backdropFilter: "blur(20px) saturate(140%)",
                  border: "1px solid rgba(255, 255, 255, 0.09)",
                }
              : {
                  backgroundColor: "rgba(255, 255, 255, 0.72)",
                  backdropFilter: "blur(20px) saturate(140%)",
                  border: "1px solid rgba(153, 0, 0, 0.08)",
                }),
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor:
              theme.palette.mode === "dark" ? "rgba(26, 10, 18, 0.6)" : "rgba(255, 255, 255, 0.6)",
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
            borderRadius: 14,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
  });
}
