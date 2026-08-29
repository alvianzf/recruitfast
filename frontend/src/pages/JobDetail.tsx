import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Badge,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import ViewListIcon from "@mui/icons-material/ViewList";
import LinkIcon from "@mui/icons-material/Link";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";

import { useCreateJob, useJob, useUpdateJob } from "../api/jobs";
import { formatSalary } from "../utils/formatSalary";
import { useToast } from "../components/ToastProvider";
import {
  useJobStages,
  usePlacements,
  useMovePlacement,
  useUpdatePlacementStatus,
  useUpdatePlacementOfferDetails,
  type Placement,
} from "../api/pipeline";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import KanbanBoard from "../components/KanbanBoard";
import AttachCandidateDialog from "../components/AttachCandidateDialog";
import JobApplicationsPanel from "../components/JobApplicationsPanel";
import JobAssignmentControl from "../components/JobAssignmentControl";
import ManagePipelineDialog from "../components/ManagePipelineDialog";
import EditJobDialog from "../components/EditJobDialog";
import StatusChip from "../components/StatusChip";
import CandidateQuickView from "../components/CandidateQuickView";
import { formatRelativeTime } from "../utils/relativeTime";

// Kanban is the default view inside a single job's pipeline (docs/03) —
// unlike the Jobs list itself, which is always Table.
type ViewMode = "kanban" | "table";

function OfferDetailsDialog({
  jobId,
  target,
  onClose,
}: {
  jobId: string;
  target: { placementId: string; candidateName: string } | null;
  onClose: () => void;
}) {
  const update = useUpdatePlacementOfferDetails(jobId);
  const [startingDate, setStartingDate] = useState("");
  const [offerRate, setOfferRate] = useState("");
  const [offerRateCurrency, setOfferRateCurrency] = useState("");

  function handleClose() {
    setStartingDate("");
    setOfferRate("");
    setOfferRateCurrency("");
    update.reset();
    onClose();
  }

  async function handleSave() {
    if (!target) return;
    await update.mutateAsync({
      placementId: target.placementId,
      starting_date: startingDate || null,
      offer_rate: offerRate === "" ? null : Number(offerRate),
      offer_rate_currency: offerRateCurrency || null,
    });
    handleClose();
  }

  return (
    <Dialog open={!!target} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Signed — offer details for {target?.candidateName}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          The actual negotiated outcome for this placement, not the job's posted salary range. You can skip this
          and fill it in later from the pipeline table.
        </DialogContentText>
        <Stack spacing={2}>
          <TextField
            size="small"
            label="Starting date"
            type="date"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            value={startingDate}
            onChange={(e) => setStartingDate(e.target.value)}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              label="Offer rate"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
              value={offerRate}
              onChange={(e) => setOfferRate(e.target.value)}
            />
            <TextField
              size="small"
              label="Currency"
              placeholder="IDR"
              sx={{ width: 110 }}
              slotProps={{ inputLabel: { shrink: true } }}
              value={offerRateCurrency}
              onChange={(e) => setOfferRateCurrency(e.target.value)}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} color="inherit">
          Skip
        </Button>
        <Button variant="contained" disabled={update.isPending} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Kanban/Table only ever show active placements (see the filtering in
// JobDetail below) — this is where a rejected/withdrawn candidate lives
// instead, with the only path back onto the board.
function WithdrawnRejectedSection({
  placements,
  onRestore,
  restoring,
  onOpenCandidate,
}: {
  placements: Placement[];
  onRestore: (placementId: string) => void;
  restoring: boolean;
  onOpenCandidate: (candidateId: string) => void;
}) {
  if (placements.length === 0) return null;

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
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => <StatusChip status={params.value as string} />,
    },
    {
      field: "actions",
      headerName: "",
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          startIcon={<ReplayOutlinedIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            onRestore(params.row.id);
          }}
          disabled={restoring}
          sx={{ whiteSpace: "nowrap" }}
        >
          Restore
        </Button>
      ),
    },
  ];

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>Withdrawn / Rejected</Typography>
          <Badge
            badgeContent={placements.length}
            color="error"
            max={99}
            sx={{ "& .MuiBadge-badge": { position: "static", transform: "none" } }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <DataGrid
          autoHeight
          rows={placements}
          columns={columns}
          density="compact"
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          onRowClick={(params) => onOpenCandidate(params.row.candidate_id)}
          sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </AccordionDetails>
    </Accordion>
  );
}

export default function JobDetail() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [view, setView] = useState<ViewMode>("kanban");
  const [attachOpen, setAttachOpen] = useState(false);
  const [managePipelineOpen, setManagePipelineOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quickViewCandidateId, setQuickViewCandidateId] = useState<string | null>(null);
  const [jobMenuAnchor, setJobMenuAnchor] = useState<HTMLElement | null>(null);
  const [pendingCloseMove, setPendingCloseMove] = useState<{ placementId: string; toStageId: string } | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    placementId: string;
    status: "rejected" | "withdrawn";
    candidateName: string;
  } | null>(null);
  const [offerDetailsTarget, setOfferDetailsTarget] = useState<{ placementId: string; candidateName: string } | null>(null);

  const { data: job, isError: jobError } = useJob(jobId);
  const { data: stages, isLoading: stagesLoading } = useJobStages(jobId);
  const { data: placements, isLoading: placementsLoading } = usePlacements(jobId);
  const move = useMovePlacement(jobId);
  const updateStatus = useUpdatePlacementStatus(jobId);
  const updateJob = useUpdateJob(jobId);
  const createJob = useCreateJob();

  const candidateIds = useMemo(() => placements?.map((p) => p.candidate_id) ?? [], [placements]);
  const activePlacements = useMemo(() => (placements ?? []).filter((p) => p.status === "active"), [placements]);
  const withdrawnOrRejected = useMemo(() => (placements ?? []).filter((p) => p.status !== "active"), [placements]);

  function handleRestore(placementId: string) {
    updateStatus.mutate({ placementId, status: "active" });
  }

  // "Close" is a quick manual close distinct from the auto-close that
  // happens when headcount fills (which sets "won" via the pipeline
  // move flow, with an offer-details prompt) — this is for "we're no
  // longer hiring for this" without a hire. "Re-open" always goes back
  // to plain "open", regardless of which closed state it was in.
  async function handleCloseJob() {
    try {
      await updateJob.mutateAsync({ status: "lost" });
      showToast("Job closed.");
    } catch {
      showToast("Could not close the job. Please try again.", "error");
    } finally {
      setJobMenuAnchor(null);
    }
  }

  async function handleReopenJob() {
    try {
      await updateJob.mutateAsync({ status: "open" });
      showToast("Job reopened.");
    } catch {
      showToast("Could not reopen the job. Please try again.", "error");
    } finally {
      setJobMenuAnchor(null);
    }
  }

  async function handleCloneJob() {
    if (!job) return;
    setJobMenuAnchor(null);
    try {
      const cloned = await createJob.mutateAsync({
        title: `${job.title} (Copy)`,
        overview: job.overview ?? undefined,
        description: job.description ?? undefined,
        headcount: job.headcount,
        work_mode: job.work_mode,
        location: job.location ?? undefined,
        seniority: job.seniority,
        job_type: job.job_type,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        salary_currency: job.salary_currency ?? undefined,
        salary_confidential: job.salary_confidential,
        client_id: job.client_id,
      });
      showToast("Job cloned.");
      navigate(`/app/jobs/${cloned.id}`);
    } catch {
      showToast("Could not clone this job. Please try again.", "error");
    }
  }

  // Any move into the terminal-success stage (Signed) is worth capturing
  // starting_date/offer_rate for — not just the one that happens to fill
  // headcount — so the prompt fires regardless of which branch below ran.
  function performMove(placementId: string, toStageId: string, promptOfferDetails: boolean) {
    move.mutate(
      { placementId, toStageId },
      {
        onSuccess: () => {
          if (promptOfferDetails) {
            const candidateName = placements?.find((p) => p.id === placementId)?.candidate.full_name ?? "this candidate";
            setOfferDetailsTarget({ placementId, candidateName });
          }
        },
      },
    );
  }

  // Dragging a card into the terminal-success stage can silently close
  // the whole job (see EditJobDialog's headcount helper text) — confirm
  // first when this specific move would actually trigger that, rather
  // than interrupting every move into that stage for multi-headcount jobs.
  function handleMove(placementId: string, toStageId: string) {
    const targetStage = stages?.find((s) => s.id === toStageId);
    if (targetStage?.is_terminal_success && job) {
      const currentOfferCount =
        placements?.filter((p) => p.status === "active" && p.current_stage_id === toStageId).length ?? 0;
      if (currentOfferCount + 1 >= job.headcount) {
        setPendingCloseMove({ placementId, toStageId });
        return;
      }
    }
    performMove(placementId, toStageId, !!targetStage?.is_terminal_success);
  }

  function requestStatusChange(placementId: string, status: "rejected" | "withdrawn") {
    const candidateName = placements?.find((p) => p.id === placementId)?.candidate.full_name ?? "this candidate";
    setPendingStatusChange({ placementId, status, candidateName });
  }

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
      width: 190,
      valueGetter: (_v, row) => stageNameById.get(row.current_stage_id) ?? "",
      renderCell: (params) => (
        <Select
          size="small"
          variant="standard"
          value={params.row.current_stage_id}
          disabled={params.row.status !== "active" || move.isPending}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleMove(params.row.id, e.target.value as string)}
          disableUnderline
          sx={{ width: "100%", fontSize: "inherit" }}
        >
          {stages?.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => <StatusChip status={params.value as string} />,
    },
  ];

  if (jobError) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }} spacing={1}>
        <Typography color="text.secondary">Couldn't load this job — it may not exist, or you may not have access.</Typography>
      </Stack>
    );
  }

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
        subtitle={`Posted ${formatRelativeTime(job.created_at)}`}
        action={{
          label: "Attach candidate",
          icon: <PersonAddAlt1OutlinedIcon fontSize="small" />,
          onClick: () => setAttachOpen(true),
        }}
      >
        <StatusChip status={job.status} />
        {job.client_name && <Chip size="small" variant="outlined" label={`Client: ${job.client_name}`} />}
        {formatSalary(job.salary_min, job.salary_max, job.salary_currency) && (
          <Tooltip title={job.salary_confidential ? "Confidential — hidden from the public job board" : ""}>
            <Chip
              size="small"
              variant="outlined"
              icon={job.salary_confidential ? <LockOutlinedIcon sx={{ fontSize: 14 }} /> : undefined}
              label={formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
            />
          </Tooltip>
        )}
        <Tooltip title="Copy application link">
          <IconButton
            size="small"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/apply/${job.slug}`)}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <JobAssignmentControl job={job} />
        <Tooltip title="Manage pipeline stages">
          <IconButton size="small" onClick={() => setManagePipelineOpen(true)}>
            <TuneOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit job">
          <IconButton size="small" onClick={() => setEditOpen(true)}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="More actions">
          <IconButton size="small" onClick={(e) => setJobMenuAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={jobMenuAnchor} open={!!jobMenuAnchor} onClose={() => setJobMenuAnchor(null)}>
          {job.status !== "lost" && job.status !== "won" && (
            <MenuItem onClick={handleCloseJob} disabled={updateJob.isPending}>
              <ListItemIcon>
                <CancelOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Close job</ListItemText>
            </MenuItem>
          )}
          {(job.status === "lost" || job.status === "won") && (
            <MenuItem onClick={handleReopenJob} disabled={updateJob.isPending}>
              <ListItemIcon>
                <ReplayOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Re-open job</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={handleCloneJob} disabled={createJob.isPending}>
            <ListItemIcon>
              <ContentCopyOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Clone job posting</ListItemText>
          </MenuItem>
        </Menu>
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
          placements={activePlacements}
          onMove={handleMove}
          onReject={(placementId) => requestStatusChange(placementId, "rejected")}
          onWithdraw={(placementId) => requestStatusChange(placementId, "withdrawn")}
          onOpenCandidate={setQuickViewCandidateId}
        />
      ) : (
        <Paper sx={{ height: 600, p: 1 }}>
          <DataGrid
            rows={activePlacements}
            columns={columns}
            density="compact"
            pageSizeOptions={[20, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 20 } },
              sorting: { sortModel: [{ field: "stage", sort: "asc" }] },
            }}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            onRowClick={(params) => setQuickViewCandidateId(params.row.candidate_id)}
            sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
          />
        </Paper>
      )}

      <WithdrawnRejectedSection
        placements={withdrawnOrRejected}
        onRestore={handleRestore}
        restoring={updateStatus.isPending}
        onOpenCandidate={setQuickViewCandidateId}
      />

      <JobApplicationsPanel jobId={jobId} onOpenCandidate={setQuickViewCandidateId} />

      <AttachCandidateDialog jobId={jobId} open={attachOpen} onClose={() => setAttachOpen(false)} />
      <ManagePipelineDialog
        jobId={jobId}
        stages={stages ?? []}
        open={managePipelineOpen}
        onClose={() => setManagePipelineOpen(false)}
      />
      <EditJobDialog job={job} open={editOpen} onClose={() => setEditOpen(false)} />
      <CandidateQuickView
        candidateIds={candidateIds}
        currentId={quickViewCandidateId}
        onNavigate={setQuickViewCandidateId}
        onClose={() => setQuickViewCandidateId(null)}
      />

      <Dialog open={!!pendingCloseMove} onClose={() => setPendingCloseMove(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Move to {stages?.find((s) => s.id === pendingCloseMove?.toStageId)?.name ?? "this stage"}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This fills the job's headcount ({job.headcount}) — moving this candidate here will also mark "
            {job.title}" as Won.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPendingCloseMove(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (pendingCloseMove) performMove(pendingCloseMove.placementId, pendingCloseMove.toStageId, true);
              setPendingCloseMove(null);
            }}
          >
            Confirm move
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingStatusChange} onClose={() => setPendingStatusChange(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Mark {pendingStatusChange?.candidateName} as {pendingStatusChange?.status}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This moves them into the Reject-flagged column for this job. You can attach them to another job's
            pipeline separately if that changes.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPendingStatusChange(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={updateStatus.isPending}
            onClick={() => {
              if (pendingStatusChange) {
                updateStatus.mutate({ placementId: pendingStatusChange.placementId, status: pendingStatusChange.status });
              }
              setPendingStatusChange(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <OfferDetailsDialog jobId={jobId} target={offerDetailsTarget} onClose={() => setOfferDetailsTarget(null)} />
    </Stack>
  );
}
