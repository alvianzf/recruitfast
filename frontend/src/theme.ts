import { createTheme, type PaletteMode } from "@mui/material";

// Brand primary + Material Design 3-flavored shape/elevation tokens.
// Every Paper (cards, modals, panels) gets the glass treatment by default,
// floating over the fixed gradient mesh in index.css (.app-background) —
// glassmorphism needs a colorful backdrop to actually read as "glass".
// Dense data tables opt back out on the specific instance
// (sx={{ backdropFilter: "none", backgroundColor: "background.paper" }}).
// See docs/06-ui-design-system.md.
export const BRAND_PRIMARY = "#3D6B94";
export const BRAND_PRIMARY_LIGHT = "#7CA8CC";
export const OFF_WHITE = "#f7f5f2";

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
        main: OFF_WHITE,
        contrastText: "#241019",
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
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,40,60,0.08)",
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
                  backgroundColor: "rgba(18, 32, 46, 0.72)",
                  backdropFilter: "blur(20px) saturate(140%)",
                  border: "1px solid rgba(255, 255, 255, 0.09)",
                }
              : {
                  backgroundColor: "rgba(255, 255, 255, 0.72)",
                  backdropFilter: "blur(20px) saturate(140%)",
                  border: "1px solid rgba(61, 107, 148, 0.08)",
                }),
          }),
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
