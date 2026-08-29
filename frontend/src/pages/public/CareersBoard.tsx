import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";

import { useAllJobsBoard, useOrgBoard, type PublicJobSummary } from "../../api/publicBoard";
import { JOB_TYPE_LABEL, SENIORITY_LABEL, WORK_MODE_LABEL, type JobType, type Seniority, type WorkMode } from "../../api/jobs";
import { formatRelativeTime } from "../../utils/relativeTime";
import { formatSalary } from "../../utils/formatSalary";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { PUBLIC_BLUE_BACKGROUND } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";

const PAGE_SIZE = 8;
const WORK_MODES: WorkMode[] = ["remote", "onsite", "hybrid"];

function matchesSearch(job: PublicJobSummary, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = `${job.title} ${job.overview ?? ""} ${job.org_name ?? ""}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export default function CareersBoard({ all = false }: { all?: boolean }) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const orgQuery = useOrgBoard(slug);
  const allJobsQuery = useAllJobsBoard();
  const { data, isLoading, isError } = all ? allJobsQuery : orgQuery;
  useDocumentMeta(
    all ? "Jobs: FastRecruit" : data?.org_name ? `${data.org_name} Jobs: FastRecruit` : "Jobs: FastRecruit",
    all
      ? "Browse every open role across FastRecruit's agencies and companies."
      : data?.org_description || `Open roles at ${data?.org_name ?? "this organization"}.`,
  );

  const [search, setSearch] = useState("");
  const [workModes, setWorkModes] = useState<Set<WorkMode>>(new Set());
  const [orgFilter, setOrgFilter] = useState("");
  const [seniorityFilter, setSeniorityFilter] = useState<Seniority | "">("");
  const [jobTypeFilter, setJobTypeFilter] = useState<JobType | "">("");
  const [page, setPage] = useState(1);

  function toggleWorkMode(mode: WorkMode) {
    setWorkModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
    setPage(1);
  }

  const orgOptions = useMemo(() => {
    if (!all) return [];
    const names = new Set<string>();
    (data?.jobs ?? []).forEach((j) => {
      if (j.org_name) names.add(j.org_name);
    });
    return Array.from(names).sort();
  }, [data?.jobs, all]);

  const filteredJobs = useMemo(() => {
    const jobs = data?.jobs ?? [];
    return jobs.filter(
      (job) =>
        matchesSearch(job, search) &&
        (workModes.size === 0 || (job.work_mode !== null && workModes.has(job.work_mode))) &&
        (!orgFilter || job.org_name === orgFilter) &&
        (!seniorityFilter || job.seniority === seniorityFilter) &&
        (!jobTypeFilter || job.job_type === jobTypeFilter),
    );
  }, [data?.jobs, search, workModes, orgFilter, seniorityFilter, jobTypeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const pagedJobs = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasOrgProfile = !all && (data?.org_logo_url || data?.org_description || data?.org_office_location || data?.org_contact_email);
  const hasActiveFilters = workModes.size > 0 || !!orgFilter || !!seniorityFilter || !!jobTypeFilter;

  return (
    <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND, display: "flex", flexDirection: "column" }}>
      <PublicNav />

      <Box sx={{ flex: 1, py: { xs: 3, md: 5 }, px: 2 }}>
        <Stack spacing={3} sx={{ maxWidth: 1320, mx: "auto" }}>
          {isLoading && (
            <Stack sx={{ alignItems: "center", py: 6 }}>
              <CircularProgress sx={{ color: "#ffffff" }} />
            </Stack>
          )}

          {isError && (
            <Paper sx={{ p: 4, textAlign: "center" }} elevation={0}>
              <Typography color="text.secondary">This job board isn't available.</Typography>
            </Paper>
          )}

          {data && (
            <>
              {hasOrgProfile ? (
                <Paper sx={{ p: 3.5 }} elevation={0}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" } }}>
                    <Avatar src={data.org_logo_url ?? undefined} sx={{ width: 72, height: 72, bgcolor: "primary.main" }}>
                      <BusinessOutlinedIcon fontSize="large" />
                    </Avatar>
                    <Stack spacing={0.5} sx={{ flex: 1 }}>
                      <Typography variant="h3" sx={{ fontSize: { xs: 24, md: 30 } }}>
                        {data.org_name}
                      </Typography>
                      {data.org_description && (
                        <Typography variant="body2" color="text.secondary">
                          {data.org_description}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap", mt: 0.5 }}>
                        {data.org_office_location && (
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <PlaceOutlinedIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {data.org_office_location}
                            </Typography>
                          </Stack>
                        )}
                        {data.org_contact_email && (
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <EmailOutlinedIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {data.org_contact_email}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                </Paper>
              ) : (
                <Typography variant="h3" sx={{ textAlign: "center", fontSize: { xs: 28, md: 34 }, color: "#ffffff" }}>
                  {all ? "Jobs" : data.org_name}
                </Typography>
              )}
              <Typography sx={{ textAlign: "center", color: "rgba(255,255,255,0.68)" }}>
                {filteredJobs.length} open position{filteredJobs.length === 1 ? "" : "s"}
              </Typography>

              {/* One bounded, off-white panel holds search/filters + the
                  whole list — cards live inside it rather than floating
                  loose on the blue page background. Search spans the full
                  container width at the top; filters + list sit below. */}
              <Paper sx={{ p: { xs: 2, md: 3 }, overflow: "hidden" }} elevation={0}>
                <TextField
                  fullWidth
                  placeholder="Search by title, keyword, or organization"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Divider sx={{ my: { xs: 2, md: 3 } }} />

                <Stack direction={{ xs: "column", md: "row" }} spacing={0} sx={{ alignItems: "flex-start" }}>
                  <Box
                    component="aside"
                    sx={{
                      width: { xs: "100%", md: 240 },
                      flexShrink: 0,
                      pr: { md: 3 },
                      pb: { xs: 2, md: 0 },
                      borderRight: { xs: "none", md: "1px solid" },
                      borderBottom: { xs: "1px solid", md: "none" },
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Work mode
                    </Typography>
                    <Stack>
                      {WORK_MODES.map((mode) => (
                        <FormControlLabel
                          key={mode}
                          control={
                            <Checkbox
                              size="small"
                              checked={workModes.has(mode)}
                              onChange={() => toggleWorkMode(mode)}
                            />
                          }
                          label={<Typography variant="body2">{WORK_MODE_LABEL[mode]}</Typography>}
                        />
                      ))}
                    </Stack>

                    <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
                      Seniority
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={seniorityFilter}
                      onChange={(e) => {
                        setSeniorityFilter(e.target.value as Seniority | "");
                        setPage(1);
                      }}
                    >
                      <MenuItem value="">
                        <em>Any seniority</em>
                      </MenuItem>
                      {Object.entries(SENIORITY_LABEL).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>

                    <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
                      Job type
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={jobTypeFilter}
                      onChange={(e) => {
                        setJobTypeFilter(e.target.value as JobType | "");
                        setPage(1);
                      }}
                    >
                      <MenuItem value="">
                        <em>Any job type</em>
                      </MenuItem>
                      {Object.entries(JOB_TYPE_LABEL).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>

                    {all && orgOptions.length > 0 && (
                      <>
                        <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
                          Organization
                        </Typography>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          value={orgFilter}
                          onChange={(e) => {
                            setOrgFilter(e.target.value);
                            setPage(1);
                          }}
                        >
                          <MenuItem value="">
                            <em>All organizations</em>
                          </MenuItem>
                          {orgOptions.map((name) => (
                            <MenuItem key={name} value={name}>
                              {name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </>
                    )}

                    <Button
                      size="small"
                      disabled={!hasActiveFilters}
                      sx={{ display: "block", mt: 2 }}
                      onClick={() => {
                        setWorkModes(new Set());
                        setOrgFilter("");
                        setSeniorityFilter("");
                        setJobTypeFilter("");
                        setPage(1);
                      }}
                    >
                      {hasActiveFilters ? "Clear filters" : "No filters applied"}
                    </Button>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0, width: "100%", pl: { md: 3 }, pt: { xs: 2, md: 0 } }}>
                    {pagedJobs.length === 0 && (
                      <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                        {filteredJobs.length === 0 && data.jobs.length > 0
                          ? "No positions match your search or filters."
                          : "No open positions right now — check back soon."}
                      </Typography>
                    )}
                    <Stack spacing={1.5}>
                      <AnimatePresence mode="popLayout">
                        {pagedJobs.map((job, i) => (
                          <motion.div
                            key={job.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.03, ease: "easeOut" }}
                          >
                            <Box
                              onClick={() => navigate(`/apply/${job.slug}`)}
                              sx={{
                                py: 2,
                                px: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: "12px",
                                cursor: "pointer",
                                transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
                                "&:hover": { borderColor: "primary.main", boxShadow: 2, transform: "translateY(-2px)" },
                              }}
                            >
                              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                                <Box sx={{ minWidth: 0 }}>
                                  {job.org_name && (
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      sx={{
                                        alignItems: "center",
                                        mb: 0.5,
                                        width: "fit-content",
                                        ...(job.board_path && { "&:hover": { textDecoration: "underline" } }),
                                      }}
                                      onClick={
                                        job.board_path
                                          ? (e) => {
                                              e.stopPropagation();
                                              navigate(job.board_path!);
                                            }
                                          : undefined
                                      }
                                    >
                                      <Avatar src={job.org_logo_url ?? undefined} sx={{ width: 18, height: 18 }}>
                                        <BusinessOutlinedIcon sx={{ fontSize: 12 }} />
                                      </Avatar>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {job.org_name}
                                      </Typography>
                                    </Stack>
                                  )}
                                  <Typography sx={{ fontWeight: 700, color: "primary.main" }}>{job.title}</Typography>
                                  {(job.work_mode || job.location) && (
                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
                                      <PlaceOutlinedIcon sx={{ fontSize: 14 }} color="action" />
                                      <Typography variant="caption" color="text.secondary">
                                        {[job.work_mode ? WORK_MODE_LABEL[job.work_mode] : null, job.location]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </Typography>
                                    </Stack>
                                  )}
                                  {job.overview && (
                                    <Box sx={{ mt: 0.5 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        {job.overview.length > 100 ? `${job.overview.slice(0, 100)}…` : job.overview}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600 }}>
                                        Details
                                      </Typography>
                                    </Box>
                                  )}
                                  {formatSalary(job.salary_min, job.salary_max, job.salary_currency) && (
                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
                                      <PaidOutlinedIcon sx={{ fontSize: 14 }} color="action" />
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                                      </Typography>
                                    </Stack>
                                  )}
                                  {(job.seniority || job.job_type) && (
                                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
                                      {job.seniority && (
                                        <Chip size="small" variant="outlined" label={SENIORITY_LABEL[job.seniority]} />
                                      )}
                                      {job.job_type && (
                                        <Chip size="small" variant="outlined" label={JOB_TYPE_LABEL[job.job_type]} />
                                      )}
                                    </Stack>
                                  )}
                                  <Typography variant="caption" sx={{ display: "block", mt: 1, color: "primary.main", opacity: 0.75 }}>
                                    {job.applicant_count} {job.applicant_count === 1 ? "person has" : "people have"} applied
                                    · Posted {formatRelativeTime(job.created_at)}
                                  </Typography>
                                </Box>
                                <ArrowForwardIcon color="action" />
                              </Stack>
                            </Box>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </Stack>

                    {pageCount > 1 && (
                      <Stack sx={{ alignItems: "center", mt: 3 }}>
                        <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </>
          )}
        </Stack>
      </Box>

      <PublicFooter />
    </Box>
  );
}
