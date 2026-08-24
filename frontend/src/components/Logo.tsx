import { Box, Stack, Typography } from "@mui/material";

export default function Logo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 32 : 40;

  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: "10px",
          bgcolor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          p: 0.5,
          boxShadow: "0 4px 14px -4px rgba(153, 0, 0, 0.5)",
        }}
      >
        <Box
          component="img"
          src="/icon-mark.png"
          alt="RecruitFast"
          sx={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </Box>
      <Typography variant={compact ? "subtitle1" : "h5"} sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
        RecruitFast
      </Typography>
    </Stack>
  );
}
