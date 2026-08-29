import { useState } from "react";
import {
  Button,
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
  TablePagination,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import { BarChart, PieChart } from "@mui/x-charts";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { usePagination } from "../hooks/usePagination";
import {
  useOrgMetrics,
  usePlatformMetrics,
  useRecruiterMetrics,
  useRecruiterPerformance,
  type JobPipelineMetrics,
  type OpportunityMetrics,
  type PlacementValueMetrics,
  type StageConversionPoint,
} from "../api/metrics";
import { useTeams } from "../api/teams";
import StatTile from "../components/StatTile";
import StatusChip from "../components/StatusChip";
import { BRAND_PRIMARY, getStatusColor, statusLabel } from "../theme";

function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}

function PlacementValueSection({ title, metrics }: { title: string; metrics: PlacementValueMetrics }) {
  const showTotal =
    metrics.by_currency.length > 1 ||
    (metrics.by_currency.length === 1 && metrics.by_currency[0].currency !== metrics.preferred_currency);

  if (metrics.by_currency.length === 0) {
    return (
      <Stack>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          —
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 1.5 }}>
        {metrics.by_currency.map((bucket) => (
          <Stack key={bucket.currency}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {fmtCurrency(bucket.total, bucket.currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              in {bucket.currency}
            </Typography>
          </Stack>
        ))}
        {showTotal && (
          <Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "secondary.main" }}>
              {metrics.total_in_preferred_currency !== null
                ? fmtCurrency(metrics.total_in_preferred_currency, metrics.preferred_currency)
                : "Conversion unavailable"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              total, converted to {metrics.preferred_currency}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

function OpportunitySection({ opportunity }: { opportunity: OpportunityMetrics }) {
  const theme = useTheme();
  // Stacked per currency rather than a single converted bar — real
  // multi-point data (one point per currency actually in use) instead of
  // manufacturing a fake time axis out of a single snapshot.
  const currencies = Array.from(
    new Set([
      ...opportunity.potential_unrealized.by_currency.map((b) => b.currency),
      ...opportunity.opportunity_lost.by_currency.map((b) => b.currency),
    ]),
  );
  const unrealizedByCurrency = new Map(opportunity.potential_unrealized.by_currency.map((b) => [b.currency, b.total]));
  const lostByCurrency = new Map(opportunity.opportunity_lost.by_currency.map((b) => [b.currency, b.total]));
  const hasChartData = currencies.length > 0;

  return (
    <Paper sx={{ p: 3, backdropFilter: "none" }}>
      <Typography sx={{ fontWeight: 700 }}>Potential unrealized &amp; opportunity lost</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Advertised salary value still on the table (open jobs) versus what was never captured (jobs marked lost),
        by currency.
      </Typography>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={4}>
          <PlacementValueSection title="Potential unrealized (open jobs)" metrics={opportunity.potential_unrealized} />
          <PlacementValueSection title="Opportunity lost (lost jobs)" metrics={opportunity.opportunity_lost} />
        </Stack>
        {hasChartData && (
          <BarChart
            height={Math.max(180, currencies.length * 70)}
            layout="horizontal"
            yAxis={[{ scaleType: "band", data: currencies }]}
            series={[
              {
                data: currencies.map((c) => unrealizedByCurrency.get(c) ?? 0),
                label: "Potential unrealized",
                color: BRAND_PRIMARY,
              },
              {
                data: currencies.map((c) => lostByCurrency.get(c) ?? 0),
                label: "Opportunity lost",
                color: getStatusColor("lost", theme.palette.mode),
              },
            ]}
          />
        )}
      </Stack>
    </Paper>
  );
}

function PipelineBreakdownTable({ jobs }: { jobs: JobPipelineMetrics[] }) {
  const { page, setPage, paged, pageSize } = usePagination(jobs, 10);
  const oldest = jobs.length > 0 ? jobs.reduce((a, b) => (a.job_age_days >= b.job_age_days ? a : b)) : null;

  return (
    <Paper sx={{ p: 3, backdropFilter: "none" }}>
      <Typography sx={{ fontWeight: 700 }}>Pipeline breakdown</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {jobs.length} job{jobs.length === 1 ? "" : "s"}
        {oldest && ` · oldest: "${oldest.job_title}" (${oldest.job_age_days}d)`}
      </Typography>
      {jobs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No jobs yet.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Candidates</TableCell>
                <TableCell align="right">Age (days)</TableCell>
                <TableCell align="right">Avg. stage days</TableCell>
                <TableCell align="right">Min</TableCell>
                <TableCell align="right">Max</TableCell>
                <TableCell align="right">Conversion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((j) => (
                <TableRow key={j.job_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{j.job_title}</TableCell>
                  <TableCell>
                    <StatusChip status={j.status} />
                  </TableCell>
                  <TableCell align="right">{j.headcount}</TableCell>
                  <TableCell align="right">{j.candidate_count}</TableCell>
                  <TableCell align="right">{j.job_age_days}</TableCell>
                  <TableCell align="right">{j.avg_stage_days ?? "—"}</TableCell>
                  <TableCell align="right">{j.min_stage_days ?? "—"}</TableCell>
                  <TableCell align="right">{j.max_stage_days ?? "—"}</TableCell>
                  <TableCell align="right">
                    {j.conversion_rate !== null ? `${Math.round(j.conversion_rate * 100)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={jobs.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[pageSize]}
          />
        </TableContainer>
      )}
    </Paper>
  );
}

function ConversionMetricsSection({
  timeToHireAvg,
  timeToHireMin,
  timeToHireMax,
  stageConversion,
}: {
  timeToHireAvg: number | null;
  timeToHireMin: number | null;
  timeToHireMax: number | null;
  stageConversion: StageConversionPoint[];
}) {
  if (timeToHireAvg === null && stageConversion.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile
            label="Time to hire (avg)"
            value={timeToHireAvg !== null ? `${timeToHireAvg}d` : "—"}
            icon={<ScheduleOutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Time to hire (fastest)" value={timeToHireMin !== null ? `${timeToHireMin}d` : "—"} icon={<ScheduleOutlinedIcon fontSize="small" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Time to hire (slowest)" value={timeToHireMax !== null ? `${timeToHireMax}d` : "—"} icon={<ScheduleOutlinedIcon fontSize="small" />} />
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, backdropFilter: "none" }}>
        <Typography sx={{ fontWeight: 700 }}>Time to convert to next stage</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How many days candidates typically sit in each stage before moving on — from every move ever made, not
          just active pipelines.
        </Typography>
        {stageConversion.length > 0 ? (
          <Stack spacing={3}>
            <BarChart
              height={260}
              xAxis={[{ scaleType: "band", data: stageConversion.map((p) => p.stage_name) }]}
              series={[{ data: stageConversion.map((p) => p.avg_days), label: "Avg. days", color: BRAND_PRIMARY }]}
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Stage</TableCell>
                    <TableCell align="right">Avg. days</TableCell>
                    <TableCell align="right">Min. days</TableCell>
                    <TableCell align="right">Max. days</TableCell>
                    <TableCell align="right">Moves</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stageConversion.map((p) => (
                    <TableRow key={p.stage_name} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{p.stage_name}</TableCell>
                      <TableCell align="right">{p.avg_days}</TableCell>
                      <TableCell align="right">{p.min_days}</TableCell>
                      <TableCell align="right">{p.max_days}</TableCell>
                      <TableCell align="right">{p.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No stage moves recorded yet.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}

const ONBOARDING_STEPS = [
  {
    icon: PersonAddOutlinedIcon,
    title: "Invite a recruiter",
    description: "Bring your team in — they can self-claim unassigned jobs or you can hand jobs off directly.",
    to: "/app/org/recruiters",
    cta: "Invite recruiter",
  },
  {
    icon: AddCircleOutlineIcon,
    title: "Post a job",
    description: "Each job gets its own customizable pipeline and a public application link.",
    to: "/app/jobs",
    cta: "Post a job",
  },
  {
    icon: BusinessOutlinedIcon,
    title: "Customize your org profile",
    description: "Add a logo, description, and location — shown on your public career page.",
    to: "/app/org/profile",
    cta: "Edit org profile",
  },
];

function GetStartedPanel() {
  return (
    <Stack spacing={2.5}>
      <Typography color="text.secondary">
        Nothing here yet — a few quick steps to get your org running.
      </Typography>
      <Grid container spacing={2}>
        {ONBOARDING_STEPS.map((step) => (
          <Grid key={step.title} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <step.icon sx={{ fontSize: 28, color: "primary.main", mb: 1.5 }} />
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                {step.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, mb: 2 }}>
                {step.description}
              </Typography>
              <Button component={RouterLink} to={step.to} variant="outlined" size="small" sx={{ alignSelf: "flex-start" }}>
                {step.cta}
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

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

      {data && (
        <Paper sx={{ p: 3, backdropFilter: "none" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <PaidOutlinedIcon fontSize="small" color="action" />
            <Typography sx={{ fontWeight: 700 }}>Placement value</Typography>
          </Stack>
          <PlacementValueSection title="Total placed" metrics={data.placement_value} />
        </Paper>
      )}

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

      {data && <OpportunitySection opportunity={data.opportunity} />}

      <ConversionMetricsSection
        timeToHireAvg={data?.time_to_hire_avg_days ?? null}
        timeToHireMin={data?.time_to_hire_min_days ?? null}
        timeToHireMax={data?.time_to_hire_max_days ?? null}
        stageConversion={data?.stage_conversion ?? []}
      />

      <PipelineBreakdownTable jobs={data?.pipeline_breakdown ?? []} />
    </Stack>
  );
}

function OrgAdminDashboard() {
  const theme = useTheme();
  const [teamId, setTeamId] = useState<string | null>(null);
  const { data: teams } = useTeams();
  const { data } = useOrgMetrics(true, teamId);
  const { data: performance } = useRecruiterPerformance(true, teamId);
  const {
    page: performancePage,
    setPage: setPerformancePage,
    paged: pagedPerformance,
    pageSize: performancePageSize,
  } = usePagination(performance ?? [], 10);

  const isFreshOrg = data && performance && data.jobs_by_status.length === 0 && performance.length === 0;
  if (isFreshOrg) {
    return <GetStartedPanel />;
  }

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

      {data && (
        <Paper sx={{ p: 3, backdropFilter: "none" }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <PaidOutlinedIcon fontSize="small" color="action" />
            <Typography sx={{ fontWeight: 700 }}>Placement value</Typography>
          </Stack>
          <PlacementValueSection title="Total placed" metrics={data.placement_value} />
        </Paper>
      )}

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
                      label: statusLabel(p.status),
                      color: getStatusColor(p.status, theme.palette.mode),
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
                { data: performance.map((p) => p.won_jobs), label: "Won", color: getStatusColor("won", theme.palette.mode) },
                { data: performance.map((p) => p.lost_jobs), label: "Lost", color: getStatusColor("lost", theme.palette.mode) },
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
                  {pagedPerformance.map((p) => (
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
              <TablePagination
                component="div"
                count={performance.length}
                page={performancePage}
                onPageChange={(_, p) => setPerformancePage(p)}
                rowsPerPage={performancePageSize}
                rowsPerPageOptions={[performancePageSize]}
              />
            </TableContainer>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No recruiters yet.
          </Typography>
        )}
      </Paper>

      {data && <OpportunitySection opportunity={data.opportunity} />}

      <ConversionMetricsSection
        timeToHireAvg={data?.time_to_hire_avg_days ?? null}
        timeToHireMin={data?.time_to_hire_min_days ?? null}
        timeToHireMax={data?.time_to_hire_max_days ?? null}
        stageConversion={data?.stage_conversion ?? []}
      />

      <PipelineBreakdownTable jobs={data?.pipeline_breakdown ?? []} />
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
