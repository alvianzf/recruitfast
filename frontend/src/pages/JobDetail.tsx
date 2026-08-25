import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Chip, CircularProgress, IconButton, Paper, Stack, Tooltip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import ViewListIcon from "@mui/icons-material/ViewList";
import LinkIcon from "@mui/icons-material/Link";

import { useJob } from "../api/jobs";
import { useJobStages, usePlacements, useMovePlacement, useUpdatePlacementStatus, type Placement } from "../api/pipeline";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import KanbanBoard from "../components/KanbanBoard";
import AttachCandidateDialog from "../components/AttachCandidateDialog";
import JobApplicationsPanel from "../components/JobApplicationsPanel";
import JobAssignmentControl from "../components/JobAssignmentControl";

// Kanban is the default view inside a single job's pipeline (docs/03) —
// unlike the Jobs list itself, which is always Table.
type ViewMode = "kanban" | "table";

export default function JobDetail() {
  const { jobId = "" } = useParams();
  const [view, setView] = useState<ViewMode>("kanban");
  const [attachOpen, setAttachOpen] = useState(false);

  const { data: job } = useJob(jobId);
  const { data: stages, isLoading: stagesLoading } = useJobStages(jobId);
  const { data: placements, isLoading: placementsLoading } = usePlacements(jobId);
  const move = useMovePlacement(jobId);
  const updateStatus = useUpdatePlacementStatus(jobId);

  const stageNameById = useMemo(() => {
    const map = new Map<string, string>();
    stages?.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [stages]);

  const columns: GridColDef<Placement>[] = [
    { field: "candidateName", headerName: "Name", flex: 1, minWidth: 180, valueGetter: (_v, row) => row.candidate.full_name },
    {
      field: "position",
      headerName: "Position",
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) => row.candidate.current_position ?? "",
    },
    {
      field: "stage",
      headerName: "Stage",
      width: 160,
      valueGetter: (_v, row) => stageNameById.get(row.current_stage_id) ?? "",
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value as string}
          color={params.value === "rejected" ? "error" : params.value === "withdrawn" ? "default" : "success"}
          variant="outlined"
        />
      ),
    },
  ];

  if (!job) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Breadcrumbs items={[{ label: "Jobs", to: "/app/jobs" }, { label: job.title }]} />
      <PageHeader
        title={job.title}
        action={{
          label: "Attach candidate",
          icon: <PersonAddAlt1OutlinedIcon fontSize="small" />,
          onClick: () => setAttachOpen(true),
        }}
      >
        <Tooltip title="Copy application link">
          <IconButton
            size="small"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/apply/${jobId}`)}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <JobAssignmentControl job={job} />
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, next) => next && setView(next)}>
          <ToggleButton value="kanban">
            <ViewKanbanIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="table">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </PageHeader>

      {stagesLoading || placementsLoading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : view === "kanban" ? (
        <KanbanBoard
          stages={stages ?? []}
          placements={placements ?? []}
          onMove={(placementId, toStageId) => move.mutate({ placementId, toStageId })}
          onReject={(placementId) => updateStatus.mutate({ placementId, status: "rejected" })}
          onWithdraw={(placementId) => updateStatus.mutate({ placementId, status: "withdrawn" })}
        />
      ) : (
        <Paper sx={{ backdropFilter: "none", height: 600, p: 1 }}>
          <DataGrid
            rows={placements ?? []}
            columns={columns}
            density="comfortable"
            pageSizeOptions={[20, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 20 } },
              sorting: { sortModel: [{ field: "stage", sort: "asc" }] },
            }}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            sx={{ border: "none" }}
          />
        </Paper>
      )}

      <JobApplicationsPanel jobId={jobId} />

      <AttachCandidateDialog jobId={jobId} open={attachOpen} onClose={() => setAttachOpen(false)} />
    </Stack>
  );
}
