import { useMemo, useState } from "react";
import {
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import LinkIcon from "@mui/icons-material/Link";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { useClaimJob, useJobs, SENIORITY_LABEL, JOB_TYPE_LABEL, type Job } from "../api/jobs";
import { useAuth } from "../auth/AuthContext";
import NewJobDialog from "./NewJobDialog";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import EditJobDialog from "../components/EditJobDialog";
import StatusChip from "../components/StatusChip";
import { useToast } from "../components/ToastProvider";
import { formatSalary } from "../utils/formatSalary";

// Jobs list is always Table (docs/03) — Kanban lives one level in, on a
// single job's own pipeline (see JobDetail.tsx).
//
// Search is a plain keyword box + point-and-click filters, not boolean
// query syntax — junior recruiters found "senior AND (react OR vue)"
// hard to type. See docs/03's Search section.

const STATUS_FILTERS = ["open", "on_hold", "won", "lost"] as const;
const ASSIGNMENT_FILTERS = ["all", "unassigned"] as const;

export default function Jobs() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Job | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<(typeof ASSIGNMENT_FILTERS)[number]>("all");
  const [seniorityFilter, setSeniorityFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const { data: jobs, isLoading } = useJobs();
  const navigate = useNavigate();
  const claim = useClaimJob();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOrgAdmin = user?.role === "org_admin";

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (jobs ?? []).filter((job) => {
      if (q && !`${job.title} ${job.overview ?? ""}`.toLowerCase().includes(q)) return false;
      if (statusFilter.length && !statusFilter.includes(job.status)) return false;
      if (assignmentFilter === "unassigned" && job.owner_recruiter_id !== null) return false;
      if (seniorityFilter && job.seniority !== seniorityFilter) return false;
      if (jobTypeFilter && job.job_type !== jobTypeFilter) return false;
      return true;
    });
  }, [jobs, search, statusFilter, assignmentFilter, seniorityFilter, jobTypeFilter]);

  const hasActiveFilters =
    !!search || statusFilter.length > 0 || assignmentFilter !== "all" || !!seniorityFilter || !!jobTypeFilter;

  function clearFilters() {
    setSearch("");
    setStatusFilter([]);
    setAssignmentFilter("all");
    setSeniorityFilter("");
    setJobTypeFilter("");
  }

  const columns: GridColDef<Job>[] = [
    { field: "title", headerName: "Title", flex: 1.2, minWidth: 200 },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (params) => <StatusChip status={String(params.value)} />,
    },
    {
      field: "owner_recruiter_id",
      headerName: "Assignment",
      width: 150,
      renderCell: (params) =>
        params.value === null ? (
          <Chip
            size="small"
            label={params.row.team_name ? `Open to ${params.row.team_name}` : "Unassigned"}
            color="warning"
            variant="outlined"
          />
        ) : null,
    },
    {
      field: "salary_min",
      headerName: "Salary",
      width: 180,
      sortable: false,
      renderCell: (params) => {
        const label = formatSalary(params.row.salary_min, params.row.salary_max, params.row.salary_currency);
        if (!label) return null;
        return (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", height: "100%" }}>
            <Typography variant="body2">{label}</Typography>
            {params.row.salary_confidential && (
              <Tooltip title="Confidential — hidden from the public job board">
                <LockOutlinedIcon sx={{ fontSize: 14 }} color="action" />
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      field: "unique_visitor_count",
      headerName: "Views",
      width: 90,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Tooltip title="Unique visitors to this job's public page">
          <span>{params.value}</span>
        </Tooltip>
      ),
    },
    {
      field: "applicant_count",
      headerName: "Applicants",
      width: 100,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Tooltip title="Candidates who applied to this job">
          <span>{params.value}</span>
        </Tooltip>
      ),
    },
    { field: "overview", headerName: "Overview", flex: 2, minWidth: 240 },
    {
      field: "actions",
      headerName: "",
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row">
          {params.row.owner_recruiter_id === null && !isOrgAdmin && (
            <Tooltip title="Claim this job">
              <IconButton
                size="small"
                disabled={claim.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  claim.mutate(params.row.id, {
                    onError: () =>
                      showToast("Could not claim this job — it may already be claimed or restricted to another team.", "error"),
                  });
                }}
              >
                <PersonAddAlt1OutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Copy application link">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`${window.location.origin}/apply/${params.row.slug}`);
              }}
            >
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit job">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setEditTarget(params.row);
              }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Jobs"
        action={{ label: "New job", icon: <AddIcon fontSize="small" />, onClick: () => setDialogOpen(true) }}
      />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs by title or overview…"
            sx={{ maxWidth: 480 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1 }}>
            <ToggleButtonGroup
              size="small"
              value={statusFilter}
              onChange={(_e, value: string[]) => setStatusFilter(value)}
            >
              {STATUS_FILTERS.map((status) => (
                <ToggleButton key={status} value={status} sx={{ textTransform: "none", px: 1.5 }}>
                  <StatusChip status={status} />
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={assignmentFilter}
              onChange={(_e, value: (typeof ASSIGNMENT_FILTERS)[number] | null) => value && setAssignmentFilter(value)}
            >
              <ToggleButton value="all" sx={{ textTransform: "none", px: 1.5 }}>
                All jobs
              </ToggleButton>
              <ToggleButton value="unassigned" sx={{ textTransform: "none", px: 1.5 }}>
                Unassigned
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField select size="small" label="Seniority" value={seniorityFilter} sx={{ minWidth: 150 }} onChange={(e) => setSeniorityFilter(e.target.value)}>
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              {Object.entries(SENIORITY_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Job type" value={jobTypeFilter} sx={{ minWidth: 150 }} onChange={(e) => setJobTypeFilter(e.target.value)}>
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              {Object.entries(JOB_TYPE_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <Chip
              label="Clear filters"
              size="small"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ height: 600, p: 1 }}>
        <DataGrid
          rows={filteredJobs}
          columns={columns}
          loading={isLoading}
          density="compact"
          pageSizeOptions={[20, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
          onRowClick={(params) => navigate(`/app/jobs/${params.id}`)}
          sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
          slots={{
            toolbar: GridToolbar,
            noRowsOverlay: () => (
              <EmptyState
                icon={<WorkOutlinedIcon />}
                title="No jobs yet"
                description="Create your first open position to start building a pipeline."
              />
            ),
          }}
          slotProps={{ toolbar: { showQuickFilter: false } }}
        />
      </Paper>

      <NewJobDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      {editTarget && <EditJobDialog job={editTarget} open onClose={() => setEditTarget(null)} />}
    </Stack>
  );
}
