import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";
import { isAxiosError } from "axios";

import { useAddStage, useDeleteStage, useReorderStages, useRenameStage, type JobStage } from "../api/pipeline";

// Every recruiter can shape their own job's pipeline — different roles at
// different companies need different stages, and a job's stages are an
// independent clone from the moment it's created (see docs/03), so
// editing here never touches any other job.
export default function ManagePipelineDialog({
  jobId,
  stages,
  open,
  onClose,
}: {
  jobId: string;
  stages: JobStage[];
  open: boolean;
  onClose: () => void;
}) {
  const renameStage = useRenameStage(jobId);
  const reorderStages = useReorderStages(jobId);
  const deleteStage = useDeleteStage(jobId);
  const addStage = useAddStage(jobId);

  const [newStageName, setNewStageName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<JobStage | null>(null);
  const [occupantCount, setOccupantCount] = useState<number | null>(null);
  const [reassignTo, setReassignTo] = useState<JobStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...stages].sort((a, b) => a.position - b.position);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderStages.mutate(reordered.map((s) => s.id));
  }

  async function handleAdd() {
    if (!newStageName.trim()) return;
    await addStage.mutateAsync(newStageName.trim());
    setNewStageName("");
  }

  async function attemptDelete(stage: JobStage, reassignToStageId?: string) {
    setError(null);
    try {
      await deleteStage.mutateAsync({ stageId: stage.id, reassignToStageId });
      setPendingDelete(null);
      setOccupantCount(null);
      setReassignTo(null);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const match = err.response.data?.detail?.match(/^(\d+)/);
        setOccupantCount(match ? Number(match[1]) : null);
        setPendingDelete(stage);
      } else {
        setError("Could not delete this stage. Please try again.");
      }
    }
  }

  function handleClose() {
    setPendingDelete(null);
    setOccupantCount(null);
    setReassignTo(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Manage pipeline stages</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {pendingDelete ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              {occupantCount ?? "Some"} candidate{occupantCount === 1 ? " is" : "s are"} currently in "
              {pendingDelete.name}". Pick another stage to move them to before deleting it.
            </Alert>
            <Autocomplete
              options={sorted.filter((s) => s.id !== pendingDelete.id)}
              getOptionLabel={(s) => s.name}
              value={reassignTo}
              onChange={(_, value) => setReassignTo(value)}
              renderInput={(params) => <TextField {...params} label="Move candidates to" autoFocus />}
            />
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
              <Button
                color="inherit"
                onClick={() => {
                  setPendingDelete(null);
                  setOccupantCount(null);
                  setReassignTo(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={!reassignTo || deleteStage.isPending}
                onClick={() => reassignTo && attemptDelete(pendingDelete, reassignTo.id)}
              >
                {deleteStage.isPending ? "Moving & deleting…" : "Move candidates & delete stage"}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {sorted.map((stage, i) => (
              <Stack key={stage.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Stack direction="row" sx={{ flexShrink: 0 }}>
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={i === sorted.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  size="small"
                  fullWidth
                  defaultValue={stage.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== stage.name) {
                      renameStage.mutate({ stageId: stage.id, name: value });
                    }
                  }}
                />
                {(stage.is_terminal_reject || stage.is_terminal_success) && (
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                    {stage.is_terminal_success ? "Terminal · success" : "Terminal · reject"}
                  </Typography>
                )}
                <IconButton size="small" onClick={() => attemptDelete(stage)} disabled={deleteStage.isPending}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small"
                label="New stage name"
                fullWidth
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon fontSize="small" />}
                onClick={handleAdd}
                disabled={!newStageName.trim() || addStage.isPending}
                sx={{ whiteSpace: "nowrap" }}
              >
                Add
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
