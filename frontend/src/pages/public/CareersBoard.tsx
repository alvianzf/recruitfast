import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { useFreelanceBoard, useOrgBoard } from "../../api/publicBoard";
import Logo from "../../components/Logo";

export default function CareersBoard({ freelance = false }: { freelance?: boolean }) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const orgQuery = useOrgBoard(slug);
  const freelanceQuery = useFreelanceBoard();
  const { data, isLoading, isError } = freelance ? freelanceQuery : orgQuery;

  return (
    <Box sx={{ minHeight: "100vh", py: { xs: 4, md: 8 }, px: 2 }}>
      <Stack spacing={4} sx={{ maxWidth: 720, mx: "auto" }}>
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
              {data.org_name}
            </Typography>
            <Typography color="text.secondary" sx={{ textAlign: "center" }}>
              Open positions
            </Typography>

            <Stack spacing={2}>
              {data.jobs.length === 0 && (
                <Paper sx={{ p: 4, textAlign: "center" }}>
                  <Typography color="text.secondary">No open positions right now — check back soon.</Typography>
                </Paper>
              )}
              {data.jobs.map((job) => (
                <Paper
                  key={job.id}
                  onClick={() => navigate(`/apply/${job.id}`)}
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
          </>
        )}
      </Stack>
    </Box>
  );
}
