import { Grid, Paper, Stack, Typography } from "@mui/material";

// Placeholder metric tiles — real charts (MUI X Charts) land once the
// backend exposes aggregated metrics endpoints. See
// docs/05-dashboards-metrics.md for the full per-role chart spec.
const PLACEHOLDER_TILES = [
  "Open jobs assigned to me",
  "Time-to-fill per active job",
  "Stage-conversion funnel",
  "Stale candidates",
];

export default function Dashboard() {
  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        Dashboard
      </Typography>
      <Grid container spacing={2}>
        {PLACEHOLDER_TILES.map((title) => (
          <Grid key={title} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 3, height: 140 }}>
              <Typography variant="body2" color="text.secondary">
                {title}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
