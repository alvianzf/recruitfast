// Shared color palette for the public pages' animated vector graphics
// (CandidateNetworkGraphic, AboutJourneyGraphic, FaqOrbitGraphic).
// Multi-hue on purpose: a single-accent graphic read as monotone against
// the navy background. Kept to muted-saturated tones rather than neon,
// so it stays vibrant without clashing with the rest of the brand system.
export const VECTOR_PALETTE = [
  "#D1653A", // ember (brand accent)
  "#2A9D8F", // teal
  "#7C6FD6", // violet
  "#E0A63E", // amber
  "#5B9BD5", // sky blue
  "#D66FA0", // rose
];

export function paletteColor(index: number): string {
  return VECTOR_PALETTE[index % VECTOR_PALETTE.length];
}
