import { Box, Stack, Typography } from "@mui/material";

// Two forward-pointing chevrons in the brand's two accent colors,
// moving the same direction, together: reads as "fast" (a
// fast-forward mark) and "collaborative" (two distinct colors moving
// as one) at once. Replaces the old stock people-icon PNG, which was
// dark red/maroon and didn't match the navy/ember brand palette
// anywhere else in the app. Plain inline SVG, no image asset needed.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="FastRecruit">
      <path d="M28 24 L54 50 L28 76" fill="none" stroke="#3D6B94" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M46 24 L72 50 L46 76" fill="none" stroke="#D1653A" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
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
          p: 0.75,
          boxShadow: "0 4px 14px -4px rgba(61, 107, 148, 0.5)",
        }}
      >
        <LogoMark size={size - 12} />
      </Box>
      <Typography
        variant={compact ? "subtitle1" : "h5"}
        sx={{ fontWeight: 800, letterSpacing: -0.5, color: light ? "#ffffff" : "text.primary" }}
      >
        FastRecruit
      </Typography>
    </Stack>
  );
}
