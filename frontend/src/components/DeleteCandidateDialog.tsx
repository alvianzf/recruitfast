import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

import { useDeleteCandidate, type Candidate } from "../api/candidates";

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

  async function handleConfirm() {
    await deleteCandidate.mutateAsync(candidate.id);
    onClose();
    onDeleted?.();
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
