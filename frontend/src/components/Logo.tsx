import { Box, Stack, Typography } from "@mui/material";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <Box
        sx={{
          width: compact ? 28 : 36,
          height: compact ? 28 : 36,
          borderRadius: "10px",
          background: "linear-gradient(135deg, #990000 0%, #ff7a59 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 14px -4px rgba(153, 0, 0, 0.6)",
        }}
      >
        <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: compact ? 14 : 17, lineHeight: 1 }}>
          R
        </Typography>
      </Box>
      <Typography variant={compact ? "subtitle1" : "h5"} sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
        RecruitFast
      </Typography>
    </Stack>
  );
}
