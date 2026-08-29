import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

import { useCandidate, useDeleteCandidate, type Candidate } from "../api/candidates";
import { useToast } from "./ToastProvider";
import StatusChip from "./StatusChip";

export default function DeleteCandidateDialog({
  candidate,
  open,
  onClose,
  onDeleted,
}: {
  candidate: Candidate;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const deleteCandidate = useDeleteCandidate();
  const { showToast } = useToast();
  // Fetching detail here (rather than requiring the caller to pass it)
  // keeps this dialog droppable into both Candidates.tsx (list rows only
  // have the plain Candidate shape) and CandidateDetail.tsx unchanged.
  const { data: detail, isLoading: detailLoading } = useCandidate(open ? candidate.id : "");
  const placements = detail?.placements ?? [];

  async function handleConfirm() {
    try {
      await deleteCandidate.mutateAsync(candidate.id);
      showToast(`${candidate.full_name} deleted.`);
      onClose();
      onDeleted?.();
    } catch {
      showToast("Could not delete this candidate. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Delete {candidate.full_name}?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: placements.length > 0 ? 1.5 : 0 }}>
          This removes the candidate from every list and pipeline view. This can't be undone from the UI.
        </Typography>
        {detailLoading ? (
          <Stack sx={{ alignItems: "center", py: 2 }}>
            <CircularProgress size={20} />
          </Stack>
        ) : (
          placements.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {candidate.full_name} is already in the pipeline for {placements.length} job
                {placements.length > 1 ? "s" : ""} — deleting also removes them from these:
              </Typography>
              <Stack spacing={0.75}>
                {placements.map((p) => (
                  <Stack key={p.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {p.job_title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {p.stage_name}
                    </Typography>
                    <StatusChip status={p.status} />
                  </Stack>
                ))}
              </Stack>
            </Stack>
          )
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={deleteCandidate.isPending || detailLoading} onClick={handleConfirm}>
          {deleteCandidate.isPending ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
