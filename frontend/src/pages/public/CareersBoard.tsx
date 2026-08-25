import { useMemo, useState } from "react";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SearchIcon from "@mui/icons-material/Search";

import { useFreelanceBoard, useOrgBoard, type PublicJobSummary } from "../../api/publicBoard";
import Logo from "../../components/Logo";

const PAGE_SIZE = 8;

function matchesSearch(job: PublicJobSummary, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = `${job.title} ${job.overview ?? ""}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export default function CareersBoard({ freelance = false }: { freelance?: boolean }) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const orgQuery = useOrgBoard(slug);
  const freelanceQuery = useFreelanceBoard();
  const { data, isLoading, isError } = freelance ? freelanceQuery : orgQuery;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredJobs = useMemo(() => {
    const jobs = data?.jobs ?? [];
    return jobs.filter((job) => matchesSearch(job, search));
  }, [data?.jobs, search]);

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const pagedJobs = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Box sx={{ minHeight: "100vh", py: { xs: 3, md: 5 }, px: 2 }}>
      <Stack spacing={4} sx={{ maxWidth: 1200, mx: "auto" }}>
        <Stack spacing={1} sx={{ alignItems: "center" }}>
          <RouterLink to="/" style={{ textDecoration: "none" }}>
            <Logo />
          </RouterLink>
        </Stack>

        {isLoading && (
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress />
          </Stack>
        )}

        {isError && (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">This careers page isn't available.</Typography>
          </Paper>
        )}

        {data && (
          <>
            <Typography variant="h4" sx={{ fontWeight: 800, textAlign: "center" }}>
              {freelance ? "Public Jobs" : data.org_name}
            </Typography>
            <Typography color="text.secondary" sx={{ textAlign: "center" }}>
              {filteredJobs.length} open position{filteredJobs.length === 1 ? "" : "s"}
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
              <Box
                component="aside"
                sx={{
                  width: { xs: "100%", md: 280 },
                  flexShrink: 0,
                  position: { md: "sticky" },
                  top: { md: 24 },
                }}
              >
                <Paper sx={{ p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Search & filter</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by title or keyword"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
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
                </Paper>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
                <Stack
                  spacing={2}
                  sx={{
                    maxHeight: { md: "calc(100vh - 220px)" },
                    overflowY: { md: "auto" },
                    pr: { md: 0.5 },
                  }}
                >
                  {pagedJobs.length === 0 && (
                    <Paper sx={{ p: 4, textAlign: "center" }}>
                      <Typography color="text.secondary">
                        {filteredJobs.length === 0 && data.jobs.length > 0
                          ? "No positions match your search."
                          : "No open positions right now — check back soon."}
                      </Typography>
                    </Paper>
                  )}
                  {pagedJobs.map((job) => (
                    <Paper
                      key={job.id}
                      onClick={() => navigate(`/apply/${job.slug}`)}
                      sx={{ p: 3, cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
                    >
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }}>{job.title}</Typography>
                          {job.overview && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {job.overview}
                            </Typography>
                          )}
                          <Chip
                            size="small"
                            variant="outlined"
                            sx={{ mt: 1.5 }}
                            label={`${job.applicant_count} ${job.applicant_count === 1 ? "person has" : "people have"} applied`}
                          />
                        </Box>
                        <ArrowForwardIcon color="action" />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>

                {pageCount > 1 && (
                  <Stack sx={{ alignItems: "center", mt: 3 }}>
                    <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" />
                  </Stack>
                )}
              </Box>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
