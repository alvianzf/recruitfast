import { useState } from "react";
import {
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";

import { useJobs } from "../api/jobs";
import NewJobDialog from "./NewJobDialog";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

// Jobs list defaults to Table (see docs/03-pipelines-and-boards.md); the
// view toggle here is a placeholder — persisting the choice per-user,
// per-list to the backend is a follow-up once user prefs exist.
type ViewMode = "table" | "kanban";

const STATUS_COLOR: Record<string, "success" | "warning" | "default" | "error"> = {
  open: "success",
  on_hold: "warning",
  filled: "default",
  cancelled: "error",
};

export default function Jobs() {
  const [view, setView] = useState<ViewMode>("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: jobs, isLoading } = useJobs();

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Jobs"
        action={{ label: "New job", icon: <AddIcon fontSize="small" />, onClick: () => setDialogOpen(true) }}
      >
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, next) => next && setView(next)}>
          <ToggleButton value="table">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="kanban">
            <ViewKanbanIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </PageHeader>

      {view === "table" ? (
        <TableContainer component={Paper} sx={{ backdropFilter: "none" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Overview</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ textAlign: "center", py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && jobs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <EmptyState
                      title="No jobs yet"
                      description="Create your first open position to start building a pipeline."
                    />
                  </TableCell>
                </TableRow>
              )}
              {jobs?.map((job) => (
                <TableRow key={job.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{job.title}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={job.status.replace("_", " ")}
                      color={STATUS_COLOR[job.status] ?? "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {job.overview || "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Typography color="text.secondary">Kanban board — coming soon.</Typography>
        </Paper>
      )}

      <NewJobDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Stack>
  );
}
