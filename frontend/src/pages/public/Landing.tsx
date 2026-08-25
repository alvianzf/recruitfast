import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, Grid, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";

import { useAuth } from "../../auth/AuthContext";
import Logo from "../../components/Logo";

const FEATURES = [
  {
    icon: TuneOutlinedIcon,
    title: "A pipeline per job, not one-size-fits-all",
    description: "Every recruiter customizes their own job's stages — add, rename, reorder, or delete, since different roles need different hiring processes.",
  },
  {
    icon: PeopleOutlinedIcon,
    title: "CV parsing that's actually structured",
    description: "Rule-based extraction by default, with an optional LLM-assisted tier for messier resumes — reviewed before it ever touches your pipeline.",
  },
  {
    icon: PublicOutlinedIcon,
    title: "A public job board, out of the box",
    description: "Org and freelance career pages with screening questions, automatic eligibility, and a search-and-filter board for candidates.",
  },
  {
    icon: GroupsOutlinedIcon,
    title: "Teams and per-recruiter performance",
    description: "Group recruiters into teams and slice dashboards — open jobs, active candidates, offers, won/lost — by team or individually.",
  },
  {
    icon: WorkOutlinedIcon,
    title: "Assign jobs, or let recruiters claim them",
    description: "Leave a job unassigned for any recruiter to self-claim, or hand it off directly — never a bottleneck on one person.",
  },
  {
    icon: BlockOutlinedIcon,
    title: "A blacklist that actually crosses tenants",
    description: "Flag a candidate once and every recruiter platform-wide is warned if that email applies again — without exposing who flagged it or why, beyond the reason itself.",
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

      <Box component="footer" sx={{ bgcolor: "#000000", color: "rgba(255,255,255,0.85)", mt: 4 }}>
        <Container maxWidth="lg" sx={{ py: 5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
            <Logo compact />
            <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 1.5 }}>
              <MuiLink component={RouterLink} to="/careers/public" color="inherit" underline="hover">
                Public Jobs
              </MuiLink>
              <MuiLink component={RouterLink} to="/login" color="inherit" underline="hover">
                Sign in
              </MuiLink>
              <MuiLink component={RouterLink} to="/register" color="inherit" underline="hover">
                Register as a freelance recruiter
              </MuiLink>
            </Stack>
          </Stack>
          <Typography variant="caption" sx={{ display: "block", mt: 3, color: "rgba(255,255,255,0.5)" }}>
            © {new Date().getFullYear()} RecruitFast. Multi-tenant recruiting, built with confidentiality
            enforced at the database layer.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
