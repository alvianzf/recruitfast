import { useState } from "react";
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { BarChart, PieChart } from "@mui/x-charts";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

import { useAuth } from "../auth/AuthContext";
import { useOrgMetrics, usePlatformMetrics, useRecruiterMetrics, useRecruiterPerformance } from "../api/metrics";
import { useTeams } from "../api/teams";
import StatTile from "../components/StatTile";
import { BRAND_PRIMARY } from "../theme";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  on_hold: "On hold",
  won: "Won",
  lost: "Lost",
};

function RecruiterDashboard() {
  const { data } = useRecruiterMetrics();

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatTile label="Open jobs" value={data?.open_jobs ?? "—"} icon={<WorkOutlinedIcon fontSize="small" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatTile label="Candidates" value={data?.total_candidates ?? "—"} icon={<PeopleOutlinedIcon fontSize="small" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatTile label="Active offers" value={data?.active_offers ?? "—"} icon={<TrendingUpIcon fontSize="small" />} />
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, backdropFilter: "none" }}>
        <Typography sx={{ fontWeight: 700, mb: 2 }}>Pipeline funnel — active candidates by stage</Typography>
        {data && data.stage_funnel.length > 0 ? (
          <BarChart
            height={280}
            xAxis={[{ scaleType: "band", data: data.stage_funnel.map((p) => p.stage_name) }]}
            series={[{ data: data.stage_funnel.map((p) => p.count), color: BRAND_PRIMARY }]}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No active candidates in your pipelines yet.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}

function OrgAdminDashboard() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const { data: teams } = useTeams();
  const { data } = useOrgMetrics(true, teamId);
  const { data: performance } = useRecruiterPerformance(true, teamId);

  return (
    <Stack spacing={3}>
      <FormControl size="small" sx={{ minWidth: 220, alignSelf: "flex-start" }}>
        <InputLabel id="team-filter-label">Team</InputLabel>
        <Select
          labelId="team-filter-label"
          label="Team"
          value={teamId ?? ""}
          onChange={(e) => setTeamId(e.target.value === "" ? null : e.target.value)}
        >
          <MenuItem value="">
            <em>All teams</em>
          </MenuItem>
          {teams?.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Grid container spacing={2}>
        {Object.entries(data?.jobs_open_30_60_90 ?? {}).map(([bucket, count]) => (
          <Grid key={bucket} size={{ xs: 12, sm: 4 }}>
            <StatTile label={`Open ${bucket} days`} value={count} icon={<WorkOutlinedIcon fontSize="small" />} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, backdropFilter: "none" }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>Jobs by status</Typography>
            {data && data.jobs_by_status.length > 0 ? (
              <PieChart
                height={260}
                series={[
                  {
                    data: data.jobs_by_status.map((p, i) => ({
                      id: i,
                      value: p.count,
                      label: STATUS_LABEL[p.status] ?? p.status,
                    })),
                  },
                ]}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No jobs yet.
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, backdropFilter: "none" }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>Recruiter workload — open jobs</Typography>
            {data && data.recruiter_workload.length > 0 ? (
              <BarChart
                height={260}
                xAxis={[{ scaleType: "band", data: data.recruiter_workload.map((p) => p.recruiter_name) }]}
                series={[{ data: data.recruiter_workload.map((p) => p.open_jobs), color: BRAND_PRIMARY }]}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No recruiters with open jobs yet.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, backdropFilter: "none" }}>
        <Typography sx={{ fontWeight: 700, mb: 2 }}>Recruiter performance breakdown</Typography>
        {performance && performance.length > 0 ? (
          <Stack spacing={3}>
            <BarChart
              height={280}
              xAxis={[{ scaleType: "band", data: performance.map((p) => p.recruiter_name) }]}
              series={[
                { data: performance.map((p) => p.won_jobs), label: "Won", color: "#2e7d32" },
                { data: performance.map((p) => p.lost_jobs), label: "Lost", color: "#c62828" },
                { data: performance.map((p) => p.active_candidates), label: "Active candidates", color: BRAND_PRIMARY },
              ]}
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recruiter</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell align="right">Open jobs</TableCell>
                    <TableCell align="right">Active candidates</TableCell>
                    <TableCell align="right">Offers</TableCell>
                    <TableCell align="right">Won</TableCell>
                    <TableCell align="right">Lost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {performance.map((p) => (
                    <TableRow key={p.recruiter_id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{p.recruiter_name}</TableCell>
                      <TableCell>{p.team_name ?? "—"}</TableCell>
                      <TableCell align="right">{p.open_jobs}</TableCell>
                      <TableCell align="right">{p.active_candidates}</TableCell>
                      <TableCell align="right">{p.offers}</TableCell>
                      <TableCell align="right">{p.won_jobs}</TableCell>
                      <TableCell align="right">{p.lost_jobs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No recruiters yet.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}

function SuperadminDashboard() {
  const { data } = usePlatformMetrics(true);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatTile label="Org tenants" value={data?.active_org_tenants ?? "—"} icon={<ApartmentOutlinedIcon fontSize="small" />} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatTile label="Freelance recruiters" value={data?.freelance_org_members ?? "—"} icon={<BadgeOutlinedIcon fontSize="small" />} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatTile label="Total recruiters" value={data?.total_recruiters ?? "—"} icon={<PeopleOutlinedIcon fontSize="small" />} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatTile label="Pending approvals" value={data?.freelance_queue_depth ?? "—"} icon={<HowToRegOutlinedIcon fontSize="small" />} />
      </Grid>
    </Grid>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Dashboard
      </Typography>
      {user?.role === "superadmin" && <SuperadminDashboard />}
      {user?.role === "org_admin" && <OrgAdminDashboard />}
      {user?.role === "recruiter" && <RecruiterDashboard />}
    </Stack>
  );
}
