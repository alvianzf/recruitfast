import { Chip, type ChipProps, useTheme } from "@mui/material";

import { getStatusColor, statusLabel } from "../theme";

// Single source of truth for status color everywhere a job/placement
// status renders — chips, Kanban accents, dashboard charts — so "won"
// (violet) and "open" (teal) are never visually confusable, and a given
// status is always the same color no matter which screen shows it. See
// theme.ts's STATUS_COLORS and docs/13-redesign.md.
export default function StatusChip({
  status,
  size = "small",
  sx,
  ...rest
}: { status: string } & Omit<ChipProps, "label" | "color">) {
  const theme = useTheme();
  const color = getStatusColor(status, theme.palette.mode);

  return (
    <Chip
      size={size}
      label={statusLabel(status)}
      sx={[
        {
          bgcolor: color,
          color: "#ffffff",
          fontWeight: 700,
          fontSize: "0.6875rem",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          height: 22,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  );
}
