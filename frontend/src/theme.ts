import { createTheme, type PaletteMode } from "@mui/material";

// Brand primary + Material Design 3-flavored shape/elevation tokens.
// Every Paper (cards, modals, panels) gets the glass treatment by default.
// Dense data tables should opt back out explicitly on the specific
// TableContainer/Paper instance (sx={{ backdropFilter: "none",
// backgroundColor: "background.paper" }}) — see docs/06-ui-design-system.md.
export const BRAND_PRIMARY = "#990000";

export function buildTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: BRAND_PRIMARY },
      background: {
        default: isDark ? "#141018" : "#fbf6f7",
        paper: isDark ? "#1e1620" : "#ffffff",
      },
    },
    shape: {
      borderRadius: 16,
    },
    typography: {
      fontFamily: '"Roboto Flex", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            ...(theme.palette.mode === "dark"
              ? {
                  backgroundColor: "rgba(30, 22, 32, 0.6)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }
              : {
                  backgroundColor: "rgba(255, 255, 255, 0.65)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                }),
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor:
              theme.palette.mode === "dark" ? "rgba(20, 16, 24, 0.7)" : "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(20px)",
            boxShadow: "none",
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
    },
  });
}
