import { useState } from "react";
import type { ReactNode } from "react";
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DashboardIcon from "@mui/icons-material/Dashboard";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import WorkIcon from "@mui/icons-material/Work";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PeopleIcon from "@mui/icons-material/People";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import BadgeIcon from "@mui/icons-material/Badge";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import PublicIcon from "@mui/icons-material/Public";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ApartmentIcon from "@mui/icons-material/Apartment";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import BusinessIcon from "@mui/icons-material/Business";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HandshakeIcon from "@mui/icons-material/Handshake";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useMe } from "../api/users";
import Logo from "./Logo";
import { BRAND_PRIMARY, BRAND_PRIMARY_DARK, BRAND_PRIMARY_DEEP, BRAND_PRIMARY_LIGHT } from "../theme";

const RECRUITER_NAV_ITEMS = [
  { label: "Dashboard", path: "/app/dashboard", icon: DashboardOutlinedIcon, activeIcon: DashboardIcon },
  { label: "Jobs", path: "/app/jobs", icon: WorkOutlinedIcon, activeIcon: WorkIcon },
  { label: "Candidates", path: "/app/candidates", icon: PeopleOutlinedIcon, activeIcon: PeopleIcon },
  { label: "Find Candidates", path: "/app/candidates/find", icon: PersonSearchOutlinedIcon, activeIcon: PersonSearchIcon },
  { label: "Open Profiles", path: "/app/open-profiles", icon: PublicOutlinedIcon, activeIcon: PublicIcon },
];

// Org-only (both org_admin and plain org recruiters) — Freelance Org
// tenants have no client roster, so this is injected conditionally in
// NavContent based on tenant_type, not baked into either static list.
const CLIENTS_NAV_ITEM = { label: "Clients", path: "/app/clients", icon: HandshakeOutlinedIcon, activeIcon: HandshakeIcon };

const ORG_ADMIN_NAV_ITEMS = [
  ...RECRUITER_NAV_ITEMS,
  { label: "Recruiters", path: "/app/org/recruiters", icon: BadgeOutlinedIcon, activeIcon: BadgeIcon },
  { label: "Org Profile", path: "/app/org/profile", icon: BusinessOutlinedIcon, activeIcon: BusinessIcon },
];

// Superadmin has no navigation path into job/candidate content at all —
// not hidden by convention, the screens genuinely aren't reachable from
// here. See docs/06-ui-design-system.md#confidentiality-aware-ui-patterns.
const SUPERADMIN_NAV_ITEMS = [
  { label: "Dashboard", path: "/app/dashboard", icon: DashboardOutlinedIcon, activeIcon: DashboardIcon },
  { label: "Freelance Recruiters", path: "/app/admin/freelance-queue", icon: HowToRegOutlinedIcon, activeIcon: HowToRegIcon },
  { label: "Organizations", path: "/app/admin/organizations", icon: ApartmentOutlinedIcon, activeIcon: ApartmentIcon },
];

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  org_admin: "Org Admin",
  recruiter: "Recruiter",
};

const SIDEBAR_WIDTH = 260;

function NavContent({
  navItems,
  pathname,
  user,
  onNavigate,
  onOpenMenu,
}: {
  navItems: typeof RECRUITER_NAV_ITEMS;
  pathname: string;
  user: ReturnType<typeof useAuth>["user"];
  onNavigate?: () => void;
  onOpenMenu: (el: HTMLElement) => void;
}) {
  const { data: me } = useMe();
  const showClients = user?.role !== "superadmin" && me?.tenant_type !== "freelance_org";
  const effectiveNavItems = showClients
    ? [...navItems.slice(0, 1), CLIENTS_NAV_ITEM, ...navItems.slice(1)]
    : navItems;

  return (
    <>
      <Box sx={{ px: 0.5, pb: 3 }}>
        <Logo compact light />
      </Box>

      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {effectiveNavItems.map((item) => {
          const isActive = item.path === pathname;
          const Icon = isActive ? item.activeIcon : item.icon;
          return (
            <Box
              key={item.path}
              component={RouterLink}
              to={item.path}
              onClick={onNavigate}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.75,
                py: 1.1,
                borderRadius: 3,
                textDecoration: "none",
                color: "#ffffff",
                bgcolor: isActive ? "secondary.main" : "transparent",
                boxShadow: isActive ? "0 6px 16px -6px rgba(0,0,0,0.35)" : "none",
                opacity: isActive ? 1 : 0.82,
                transition: "background-color 120ms ease, opacity 120ms ease",
                "&:hover": {
                  bgcolor: isActive ? "secondary.main" : "rgba(255,255,255,0.1)",
                  opacity: 1,
                },
              }}
            >
              <Icon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.16)" }} />

      <Stack
        direction="row"
        spacing={1.5}
        onClick={(e) => onOpenMenu(e.currentTarget)}
        sx={{
          alignItems: "center",
          cursor: "pointer",
          px: 0.5,
          py: 0.5,
          borderRadius: 3,
          "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
        }}
      >
        <Avatar src={me?.avatar_url ?? undefined} sx={{ width: 34, height: 34, bgcolor: "secondary.main", fontSize: 14 }}>
          {user?.role?.[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "#ffffff" }} noWrap>
            {me?.full_name ?? (user ? ROLE_LABEL[user.role] : "")}
          </Typography>
          <Typography variant="caption" noWrap sx={{ display: "block", color: "rgba(255,255,255,0.65)" }}>
            {user ? ROLE_LABEL[user.role] : ""}
          </Typography>
        </Box>
      </Stack>
    </>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems =
    user?.role === "superadmin"
      ? SUPERADMIN_NAV_ITEMS
      : user?.role === "org_admin"
        ? ORG_ADMIN_NAV_ITEMS
        : RECRUITER_NAV_ITEMS;

  // Signature treatment for the nav rail — a deep blue gradient rather
  // than the app's default flat card, so it reads as chrome/wayfinding
  // (distinct from content) and gives every screen a strong, consistent
  // anchor of contrast against the off-white app background. Same
  // gradient on the mobile drawer for consistency.
  const gradientSx = {
    backgroundImage: `linear-gradient(160deg, ${BRAND_PRIMARY_LIGHT} 0%, ${BRAND_PRIMARY} 45%, ${BRAND_PRIMARY_DARK} 80%, ${BRAND_PRIMARY_DEEP} 100%)`,
    border: "none",
    boxShadow: "0 24px 48px -24px rgba(20, 46, 66, 0.5)",
  };

  return (
    // height (not minHeight) + overflow hidden here is what pins the
    // sidebar — only the <main> column below gets its own scrollbar,
    // instead of the whole page (sidebar included) scrolling together.
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          height: "100%",
          p: 2,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
        }}
      >
        <Paper
          sx={[{ p: 2.5, flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }, gradientSx]}
          elevation={0}
        >
          <NavContent navItems={navItems} pathname={pathname} user={user} onOpenMenu={(el) => setMenuAnchor(el)} />
        </Paper>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            display: { xs: "flex", md: "none" },
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.5,
            flexShrink: 0,
          }}
        >
          <IconButton onClick={() => setMobileNavOpen(true)} edge="start">
            <MenuIcon />
          </IconButton>
          <Logo compact />
        </Box>

        <Box component="main" sx={{ flex: 1, overflowY: "auto", p: { xs: 2, md: 3 } }}>
          <Box sx={{ maxWidth: 1200, mx: "auto" }}>{children}</Box>
        </Box>
      </Box>

      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} slotProps={{ paper: { sx: gradientSx } }}>
        <Box sx={{ width: 280, p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
          <NavContent
            navItems={navItems}
            pathname={pathname}
            user={user}
            onNavigate={() => setMobileNavOpen(false)}
            onOpenMenu={(el) => setMenuAnchor(el)}
          />
        </Box>
      </Drawer>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            navigate("/app/profile");
          }}
        >
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          My profile
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            logout();
            // A hard navigation, not react-router's navigate() — this
            // component is still mounted inside ProtectedRoute at the
            // moment logout() clears the user, and ProtectedRoute's own
            // reactive <Navigate to="/login"> redirect can win a race
            // against a same-tick navigate("/") call, landing back on
            // the login form instead of the public site. A full
            // navigation tears down the whole protected tree first, so
            // there's nothing left to race.
            window.location.assign("/");
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </Box>
  );
}
