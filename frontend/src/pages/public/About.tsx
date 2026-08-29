import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Button, Container, Grid, Paper, Stack, Typography } from "@mui/material";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { BRAND_PRIMARY_DARK, BRAND_PRIMARY_DEEP } from "../../theme";
import { PUBLIC_BLUE_BACKGROUND, PUBLIC_GLASS_SX, publicOutlinedButtonSx } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import AboutJourneyGraphic from "./AboutJourneyGraphic";

const VALUES = [
  {
    icon: BoltOutlinedIcon,
    title: "Fast",
    description: "A pipeline you can set up in minutes, an application flow candidates finish in one sitting, and dashboards that show what is actually slowing hiring down.",
  },
  {
    icon: GroupsOutlinedIcon,
    title: "Collaborative",
    description: "One shared talent pool across recruiters, teams, and even other organizations, so good candidates get considered for more than the single job they applied to.",
  },
  {
    icon: ShieldOutlinedIcon,
    title: "Trustworthy",
    description: "Confidentiality is enforced where it matters most: the database itself, not just hidden in the interface. A blacklist warning crosses tenants without exposing who raised it.",
  },
];

export default function About() {
  useDocumentMeta(
    "About FastRecruit",
    "FastRecruit exists to make hiring feel less like paperwork and more like teamwork, for recruiters and candidates alike.",
  );
  return (
    <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND }}>
      <PublicNav />

      <Container maxWidth="md" sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 6, md: 8 }, textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <Typography variant="h1" sx={{ fontSize: { xs: 36, md: 56 }, color: "#ffffff" }}>
            Hiring that moves like a{" "}
            <Box component="span" sx={{ color: "secondary.main" }}>
              team
            </Box>
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, mt: 3, maxWidth: 640, mx: "auto", color: "rgba(255,255,255,0.78)" }}>
            FastRecruit exists to make hiring feel less like paperwork and more like teamwork, for the recruiters
            running the process and the candidates going through it.
          </Typography>
        </motion.div>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
        <Paper sx={[{ p: { xs: 4, md: 6 } }, PUBLIC_GLASS_SX]} elevation={0}>
          <Typography variant="overline" sx={{ color: "secondary.main", letterSpacing: 2, fontWeight: 700, display: "block", textAlign: "center", mb: 1 }}>
            How it works
          </Typography>
          <Typography variant="h4" sx={{ color: "#ffffff", fontWeight: 800, textAlign: "center", mb: 5 }}>
            From first application to a tracked hire
          </Typography>
          <AboutJourneyGraphic />
        </Paper>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Typography variant="h4" sx={{ color: "#ffffff", fontWeight: 800, textAlign: "center", mb: 5 }}>
          What we build around
        </Typography>
        <Grid container spacing={4}>
          {VALUES.map((value, i) => (
            <Grid key={value.title} size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
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
                    <value.icon fontSize="small" />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, color: "#ffffff" }}>
                    {value.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)" }}>
                    {value.description}
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="md" sx={{ pb: { xs: 10, md: 16 }, textAlign: "center" }}>
        <Typography variant="h4" sx={{ color: "#ffffff", fontWeight: 800, mb: 2 }}>
          See it for yourself
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.78)", mb: 4, maxWidth: 480, mx: "auto" }}>
          Browse open roles as a candidate, or sign in to see the recruiter side of the same pipeline.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "center" }}>
          <Button component={RouterLink} to="/jobs" variant="contained" color="secondary" size="large">
            Browse open jobs
          </Button>
          <Button component={RouterLink} to="/faq" variant="outlined" size="large" sx={publicOutlinedButtonSx}>
            Read the FAQ
          </Button>
        </Stack>
      </Container>

      <PublicFooter />
    </Box>
  );
}
