import { useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Box, Button, Container, Divider, Drawer, IconButton, Stack } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "../../auth/AuthContext";
import Logo from "../../components/Logo";

const LINKS = [
  { to: "/jobs", label: "Jobs" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
];

// A small dot before the label, not a background highlight (the public
// nav sits on the same gradient every page uses, so a highlight pill
// would need its own per-page contrast tuning — a dot doesn't).
function ActiveDot() {
  return (
    <Box
      component="span"
      sx={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        bgcolor: "secondary.main",
        display: "inline-block",
        mr: 1,
        flexShrink: 0,
      }}
    />
  );
}

function isLinkActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

// Shared header for every public/unauthenticated page (Landing,
// CareersBoard, ApplyPage) — one nav, one set of links, so the public
// surface reads as one consistent product instead of three different
// pages. See docs/13-redesign.md.
export default function PublicNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const authAction = user ? (
    <Button component={RouterLink} to="/app/dashboard" variant="contained" color="secondary" onClick={() => setMobileOpen(false)}>
      Dashboard
    </Button>
  ) : (
    // One combined entry point instead of separate sign-in/sign-up
    // buttons — Login already surfaces "Register here" for new
    // recruiters, so one click gets either audience where they need
    // to go without splitting the nav into two competing CTAs.
    <Button component={RouterLink} to="/login" variant="contained" color="secondary" onClick={() => setMobileOpen(false)}>
      Recruiter sign in
    </Button>
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <RouterLink to="/" style={{ textDecoration: "none" }}>
          <Logo light />
        </RouterLink>

        {/* Five items (4 links + auth action) don't reliably fit a phone
            width in one row — collapse to a hamburger drawer below md,
            same pattern as the authenticated app's AppShell. */}
        <Stack direction="row" spacing={1.5} sx={{ display: { xs: "none", md: "flex" } }}>
          {LINKS.map((link) => (
            <Button key={link.to} component={RouterLink} to={link.to} sx={{ color: "#ffffff" }}>
              {isLinkActive(pathname, link.to) && <ActiveDot />}
              {link.label}
            </Button>
          ))}
          {authAction}
        </Stack>

        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{ display: { xs: "flex", md: "none" }, color: "#ffffff" }}
          aria-label="Open menu"
        >
          <MenuIcon />
        </IconButton>
      </Stack>

      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 260, p: 2.5, height: "100%", display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ mb: 1 }}>
            <Logo compact />
          </Box>
          <Divider sx={{ mb: 1 }} />
          {LINKS.map((link) => (
            <Button
              key={link.to}
              component={RouterLink}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              sx={{ justifyContent: "flex-start" }}
            >
              {isLinkActive(pathname, link.to) && <ActiveDot />}
              {link.label}
            </Button>
          ))}
          <Divider sx={{ my: 1 }} />
          {authAction}
        </Box>
      </Drawer>
    </Container>
  );
}
