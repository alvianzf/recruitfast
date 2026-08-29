import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Button, Container, Stack, Typography } from "@mui/material";

import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { PUBLIC_BLUE_BACKGROUND, publicOutlinedButtonSx } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import { LogoMark } from "../../components/Logo";

export default function NotFound() {
  useDocumentMeta("Page not found: FastRecruit", "The page you're looking for doesn't exist or may have moved.");
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: PUBLIC_BLUE_BACKGROUND }}>
      <PublicNav />

      <Container
        maxWidth="sm"
        sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", py: 10 }}
      >
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <Stack spacing={3} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "20px",
                bgcolor: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.9,
              }}
            >
              <LogoMark size={40} />
            </Box>
            <Typography variant="h2" sx={{ fontSize: { xs: 64, md: 88 }, fontWeight: 800, color: "#ffffff" }}>
              404
            </Typography>
            <Typography variant="h5" sx={{ color: "#ffffff", fontWeight: 700 }}>
              This page doesn't exist
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.72)", maxWidth: 420 }}>
              The link may be broken, or the page may have moved. Check the address, or head back to somewhere that does exist.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Button component={RouterLink} to="/" variant="contained" color="secondary" size="large">
                Back to home
              </Button>
              <Button component={RouterLink} to="/jobs" variant="outlined" size="large" sx={publicOutlinedButtonSx}>
                Browse jobs
              </Button>
            </Stack>
          </Stack>
        </motion.div>
      </Container>

      <PublicFooter />
    </Box>
  );
}
