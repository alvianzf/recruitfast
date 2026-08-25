import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

import { useDeleteCandidate, type Candidate } from "../api/candidates";
import { useToast } from "./ToastProvider";

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
        <Typography variant="body2" color="text.secondary">
          This removes the candidate from every list and pipeline view. This can't be undone from the
          UI.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={deleteCandidate.isPending} onClick={handleConfirm}>
          {deleteCandidate.isPending ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
