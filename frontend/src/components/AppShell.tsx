import { useState } from "react";
import type { ReactNode } from "react";
import {
  Avatar,
  Box,
  Divider,
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
import LogoutIcon from "@mui/icons-material/Logout";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";

const RECRUITER_NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: DashboardOutlinedIcon, activeIcon: DashboardIcon },
  { label: "Jobs", path: "/jobs", icon: WorkOutlinedIcon, activeIcon: WorkIcon },
  { label: "Candidates", path: "/candidates", icon: PeopleOutlinedIcon, activeIcon: PeopleIcon },
];

// Superadmin has no navigation path into job/candidate content at all —
// not hidden by convention, the screens genuinely aren't reachable from
// here. See docs/06-ui-design-system.md#confidentiality-aware-ui-patterns.
const SUPERADMIN_NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: DashboardOutlinedIcon, activeIcon: DashboardIcon },
  { label: "Freelance Queue", path: "/admin/freelance-queue", icon: HowToRegOutlinedIcon, activeIcon: HowToRegIcon },
];

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  org_admin: "Org Admin",
  recruiter: "Recruiter",
};

const SIDEBAR_WIDTH = 260;

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const navItems = user?.role === "superadmin" ? SUPERADMIN_NAV_ITEMS : RECRUITER_NAV_ITEMS;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          p: 2,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
        }}
      >
        <Paper sx={{ p: 2.5, flex: 1, display: "flex", flexDirection: "column" }} elevation={0}>
          <Box sx={{ px: 0.5, pb: 3 }}>
            <Logo compact />
          </Box>

          <Stack spacing={0.5} sx={{ flex: 1 }}>
            {navItems.map((item) => {
              const isActive = item.path === pathname;
              const Icon = isActive ? item.activeIcon : item.icon;
              return (
                <Box
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.75,
                    py: 1.1,
                    borderRadius: 3,
                    textDecoration: "none",
                    color: isActive ? "primary.contrastText" : "text.primary",
                    bgcolor: isActive ? "primary.main" : "transparent",
                    transition: "background-color 120ms ease",
                    "&:hover": {
                      bgcolor: isActive ? "primary.main" : "action.hover",
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

          <Divider sx={{ my: 2 }} />

          <Stack
            direction="row"
            spacing={1.5}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{
              alignItems: "center",
              cursor: "pointer",
              px: 0.5,
              py: 0.5,
              borderRadius: 3,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 14 }}>
              {user?.role?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {user ? ROLE_LABEL[user.role] : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                {user?.tenantId ? "Org workspace" : "Platform"}
              </Typography>
            </Box>
          </Stack>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                logout();
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Paper>
      </Box>

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, pl: { md: 0 }, maxWidth: "100%" }}>
        <Box sx={{ maxWidth: 1200, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
