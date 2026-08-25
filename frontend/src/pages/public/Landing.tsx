import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";

import { useAuth } from "../../auth/AuthContext";
import Logo from "../../components/Logo";

const FEATURES = [
  {
    icon: WorkOutlinedIcon,
    title: "Pipelines that fit how you work",
    description: "Customizable stages, Kanban or table view, drag-and-drop with full keyboard parity.",
  },
  {
    icon: PeopleOutlinedIcon,
    title: "CV parsing without a hosted LLM",
    description: "Structured extraction from resumes, reviewed before it ever touches your pipeline.",
  },
  {
    icon: PublicOutlinedIcon,
    title: "A public job board, out of the box",
    description: "Org and freelance career pages with screening questions and automatic eligibility.",
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Logo />
          <Stack direction="row" spacing={1.5}>
            <Button component={RouterLink} to="/careers/public" color="inherit">
              Public Jobs
            </Button>
            {user ? (
              <Button component={RouterLink} to="/app/dashboard" variant="contained">
                Dashboard
              </Button>
            ) : (
              <>
                <Button component={RouterLink} to="/login" variant="outlined">
                  Sign in
                </Button>
                <Button component={RouterLink} to="/register" variant="contained">
                  Register
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Container>

      <Container maxWidth="md" sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 8, md: 12 }, textAlign: "center" }}>
        <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: -1, fontSize: { xs: 36, md: 56 } }}>
          Recruiting workspace built for speed
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mt: 2, maxWidth: 640, mx: "auto" }}>
          Pipelines, candidates, and a public job board for agencies and freelance recruiters —
          with confidentiality boundaries built into the database, not just the UI.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "center", mt: 4 }}>
          {user ? (
            <Button component={RouterLink} to="/app/dashboard" variant="contained" size="large">
              Go to your dashboard
            </Button>
          ) : (
            <>
              <Button component={RouterLink} to="/careers/public" variant="contained" size="large">
                View Jobs
              </Button>
              <Button component={RouterLink} to="/login" variant="outlined" size="large">
                Sign in to your workspace
              </Button>
            </>
          )}
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
        <Grid container spacing={3}>
          {FEATURES.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3.5, height: "100%" }}>
                <feature.icon sx={{ fontSize: 32, color: "primary.main", mb: 1.5 }} />
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{feature.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
