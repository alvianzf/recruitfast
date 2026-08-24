import { useState } from "react";
import { Chip, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";

import { useJobs, type Job } from "../api/jobs";
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

const columns: GridColDef<Job>[] = [
  { field: "title", headerName: "Title", flex: 1.2, minWidth: 200 },
  {
    field: "status",
    headerName: "Status",
    width: 130,
    renderCell: (params) => (
      <Chip
        size="small"
        label={String(params.value).replace("_", " ")}
        color={STATUS_COLOR[params.value as string] ?? "default"}
        variant="outlined"
      />
    ),
  },
  { field: "overview", headerName: "Overview", flex: 2, minWidth: 240 },
];

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
        <Paper sx={{ backdropFilter: "none", height: 600, p: 1 }}>
          <DataGrid
            rows={jobs ?? []}
            columns={columns}
            loading={isLoading}
            density="comfortable"
            pageSizeOptions={[20, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
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
            slotProps={{ toolbar: { showQuickFilter: true } }}
            sx={{ border: "none" }}
          />
        </Paper>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Typography color="text.secondary">Kanban board — coming soon.</Typography>
        </Paper>
      )}

      <NewJobDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Stack>
  );
}
