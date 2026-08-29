// Shared "blue-glassy" treatment for the public-facing marketing/job-board
// surfaces (Landing, CareersBoard) — a deep blue gradient mesh (same
// formula as the app's dark-mode .app-background in index.css, tuned to
// the brand blue ramp) with translucent, blurred glass cards on top. Kept
// local to these public pages rather than the shared theme/background
// since the authenticated product intentionally stays off-white/flat —
// see docs/13-redesign.md.
export const PUBLIC_BLUE_BACKGROUND = `
  radial-gradient(circle at 15% 15%, rgba(124, 168, 204, 0.35), transparent 45%),
  radial-gradient(circle at 85% 20%, rgba(124, 168, 204, 0.22), transparent 50%),
  radial-gradient(circle at 50% 100%, rgba(36, 75, 107, 0.4), transparent 55%),
  linear-gradient(160deg, #142E42 0%, #1D435F 45%, #142E42 100%)
`;

export const PUBLIC_GLASS_SX = {
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  backdropFilter: "blur(20px) saturate(140%)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  backgroundImage: "none",
};

export const publicOutlinedButtonSx = {
  color: "#ffffff",
  borderColor: "rgba(255,255,255,0.5)",
  "&:hover": { borderColor: "#ffffff", backgroundColor: "rgba(255,255,255,0.08)" },
};
