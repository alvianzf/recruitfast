import { useState } from "react";
import { Chip, IconButton, Paper, Stack, Tooltip } from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import WorkOutlinedIcon from "@mui/icons-material/WorkOutlined";
import LinkIcon from "@mui/icons-material/Link";

import { useJobs, type Job } from "../api/jobs";
import NewJobDialog from "./NewJobDialog";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

// Jobs list is always Table (docs/03) — Kanban lives one level in, on a
// single job's own pipeline (see JobDetail.tsx).
const STATUS_COLOR: Record<string, "success" | "warning" | "default" | "error"> = {
  open: "success",
  on_hold: "warning",
  won: "success",
  lost: "error",
};

export default function Jobs() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: jobs, isLoading } = useJobs();
  const navigate = useNavigate();

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
    {
      field: "actions",
      headerName: "",
      width: 60,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Tooltip title="Copy application link">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(`${window.location.origin}/apply/${params.row.id}`);
            }}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Jobs"
        action={{ label: "New job", icon: <AddIcon fontSize="small" />, onClick: () => setDialogOpen(true) }}
      />

      <Paper sx={{ backdropFilter: "none", height: 600, p: 1 }}>
        <DataGrid
          rows={jobs ?? []}
          columns={columns}
          loading={isLoading}
          density="comfortable"
          pageSizeOptions={[20, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
          onRowClick={(params) => navigate(`/jobs/${params.id}`)}
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
          slotProps={{ toolbar: { showQuickFilter: true } }}
        />
      </Paper>

      <NewJobDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Stack>
  );
}
