import { Grid, Stack, Typography } from "@mui/material";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";

import { useJobs } from "../api/jobs";
import StatTile from "../components/StatTile";

// Real counts land once metrics endpoints exist (docs/05); "Open jobs" is
// wired to live data now since /jobs already exists, the rest are
// placeholder pending backend aggregation.
export default function Dashboard() {
  const { data: jobs } = useJobs();
  const openJobs = jobs?.filter((j) => j.status === "open").length ?? 0;

  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Dashboard
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Open jobs" value={openJobs} icon={<WorkOutlinedIcon fontSize="small" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Avg. time-to-fill" value="—" icon={<ScheduleIcon fontSize="small" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Offers this month" value="—" icon={<TrendingUpIcon fontSize="small" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Stale candidates" value="—" icon={<PersonOffOutlinedIcon fontSize="small" />} />
        </Grid>
      </Grid>
    </Stack>
  );
}
