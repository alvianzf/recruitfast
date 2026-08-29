import { Link as RouterLink } from "react-router-dom";
import { Box, Container, Link as MuiLink, Stack, Typography } from "@mui/material";

import Logo from "../../components/Logo";

// Shared footer for every public/unauthenticated page — see PublicNav.tsx.
export default function PublicFooter() {
  return (
    <Box component="footer" sx={{ borderTop: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", mt: 4 }}>
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <Logo compact light />
          <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <MuiLink component={RouterLink} to="/jobs" color="inherit" underline="hover">
              Jobs
            </MuiLink>
            <MuiLink component={RouterLink} to="/pricing" color="inherit" underline="hover">
              Pricing
            </MuiLink>
            <MuiLink component={RouterLink} to="/about" color="inherit" underline="hover">
              About
            </MuiLink>
            <MuiLink component={RouterLink} to="/faq" color="inherit" underline="hover">
              FAQ
            </MuiLink>
            <MuiLink component={RouterLink} to="/login" color="inherit" underline="hover">
              Recruiter sign in
            </MuiLink>
          </Stack>
        </Stack>
        <Typography variant="caption" sx={{ display: "block", mt: 3, color: "rgba(255,255,255,0.5)" }}>
          © {new Date().getFullYear()} FastRecruit. Multi-tenant recruiting, built with confidentiality
          enforced at the database layer.
        </Typography>
      </Container>
    </Box>
  );
}
