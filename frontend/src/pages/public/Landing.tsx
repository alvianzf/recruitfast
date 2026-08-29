import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Button, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";

import { useAuth } from "../../auth/AuthContext";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { BRAND_PRIMARY_DARK, BRAND_PRIMARY_DEEP } from "../../theme";
import { PUBLIC_BLUE_BACKGROUND, PUBLIC_GLASS_SX, publicOutlinedButtonSx } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import CandidateNetworkGraphic from "./CandidateNetworkGraphic";

const FEATURES = [
  {
    icon: TuneOutlinedIcon,
    title: "A pipeline per job, not one-size-fits-all",
    description: "Every recruiter customizes their own job's stages: add, rename, reorder, or delete, since different roles need different hiring processes.",
  },
  {
    icon: PeopleOutlinedIcon,
    title: "CV parsing that's actually structured",
    description: "Rule-based extraction by default, with an optional LLM-assisted tier for messier resumes, reviewed before it ever touches your pipeline.",
  },
  {
    icon: PublicOutlinedIcon,
    title: "A public job board, out of the box",
    description: "Org and freelance career pages with screening questions, automatic eligibility, and a search-and-filter board for candidates.",
  },
  {
    icon: GroupsOutlinedIcon,
    title: "Teams and per-recruiter performance",
    description: "Group recruiters into teams and slice dashboards (open jobs, active candidates, offers, won/lost) by team or individually.",
  },
  {
    icon: WorkOutlinedIcon,
    title: "Assign jobs, or let recruiters claim them",
    description: "Leave a job unassigned for any recruiter to self-claim, or hand it off directly, so it's never a bottleneck on one person.",
  },
  {
    icon: BlockOutlinedIcon,
    title: "A blacklist that actually crosses tenants",
    description: "Flag a candidate once and every recruiter platform-wide is warned if that email applies again, without exposing who flagged it or why, beyond the reason itself.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  useDocumentMeta(
    "FastRecruit: recruiting workspace built for speed",
    "Pipelines, candidates, and a public job board for agencies and freelance recruiters. Apply to jobs with no account needed, or sign in as a recruiter.",
  );

  return (
    <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND }}>
      <PublicNav />

      <Container maxWidth="md" sx={{ pt: { xs: 8, md: 14 }, pb: { xs: 10, md: 18 }, textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center", mb: 2 }}>
            <BoltOutlinedIcon sx={{ color: "secondary.main", fontSize: 20 }} />
            <Typography
              variant="overline"
              sx={{ color: "rgba(255,255,255,0.8)", letterSpacing: 2, fontWeight: 700 }}
            >
              Fast for recruiters. Collaborative for everyone.
            </Typography>
          </Stack>
          <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 64 }, color: "#ffffff" }}>
            Recruiting workspace built for{" "}
            <Box component="span" sx={{ color: "secondary.main" }}>
              speed
            </Box>
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, mt: 3, maxWidth: 640, mx: "auto", color: "rgba(255,255,255,0.78)" }}>
            Pipelines, candidates, and a public job board for agencies and freelance recruiters, built to move
            fast and work together, with confidentiality boundaries built into the database, not just the UI.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ justifyContent: "center", mt: 5 }}>
            {user ? (
              <Button component={RouterLink} to="/app/dashboard" variant="contained" color="secondary" size="large">
                Go to your dashboard
              </Button>
            ) : (
              <>
                <Button component={RouterLink} to="/jobs" variant="contained" color="secondary" size="large">
                  View Jobs
                </Button>
                <Button component={RouterLink} to="/login" variant="outlined" size="large" sx={publicOutlinedButtonSx}>
                  Recruiter sign in
                </Button>
              </>
            )}
          </Stack>
          <Typography variant="body2" sx={{ mt: 2, color: "rgba(255,255,255,0.6)" }}>
            No account needed to apply for a job. Signing in is for recruiters and agencies.
          </Typography>
        </motion.div>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Paper sx={[{ p: { xs: 4, md: 6 } }, PUBLIC_GLASS_SX]} elevation={0}>
          <Grid container spacing={4} sx={{ alignItems: "center" }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography
                variant="overline"
                sx={{ color: "secondary.main", letterSpacing: 2, fontWeight: 700 }}
              >
                For candidates
              </Typography>
              <Typography variant="h3" sx={{ color: "#ffffff", fontWeight: 800, mt: 1, mb: 2 }}>
                Upload once. Get seen by every recruiter on the platform.
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.78)", mb: 2, maxWidth: 480 }}>
                Apply to any job and opt in to be considered for other roles: your profile becomes visible to
                every recruiter across FastRecruit, not just the one you applied to. One CV, collaboratively
                shared across the whole platform, so opportunities find you faster.
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.6)", mb: 3, fontWeight: 600 }}>
                No account needed. Just apply.
              </Typography>
              <Button component={RouterLink} to="/jobs" variant="contained" color="secondary" size="large">
                Browse open jobs
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <CandidateNetworkGraphic />
            </Grid>
          </Grid>
        </Paper>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Typography variant="overline" sx={{ color: "secondary.main", letterSpacing: 2, fontWeight: 700 }}>
            For recruiters and agencies
          </Typography>
          <Typography variant="h3" sx={{ color: "#ffffff", fontWeight: 800, mt: 1 }}>
            Everything a hiring team needs, built to move fast
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {FEATURES.map((feature, i) => (
            <Grid key={feature.title} size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
                style={{ height: "100%" }}
              >
                <Paper sx={[{ p: 5, height: "100%" }, PUBLIC_GLASS_SX]} elevation={0}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundImage: `radial-gradient(circle at 30% 30%, ${BRAND_PRIMARY_DARK}, ${BRAND_PRIMARY_DEEP})`,
                      color: "#ffffff",
                      mb: 2,
                    }}
                  >
                    <feature.icon fontSize="small" />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, color: "#ffffff" }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)" }}>
                    {feature.description}
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      <PublicFooter />
    </Box>
  );
}
