import { AppBar, Box, Container, Tab, Tabs, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/" },
  { label: "Jobs", path: "/jobs" },
  { label: "Candidates", path: "/candidates" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const currentTab = NAV_ITEMS.find((item) => item.path === pathname)?.path ?? false;

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar sx={{ gap: 4 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
            RecruitFast
          </Typography>
          <Tabs value={currentTab} textColor="primary" indicatorColor="primary">
            {NAV_ITEMS.map((item) => (
              <Tab key={item.path} label={item.label} value={item.path} component={RouterLink} to={item.path} />
            ))}
          </Tabs>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
