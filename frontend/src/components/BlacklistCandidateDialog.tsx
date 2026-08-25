import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";

import { useBlacklistCandidate } from "../api/pipeline";

export default function BlacklistCandidateDialog({
  candidateId,
  open,
  onClose,
}: {
  candidateId: string;
  open: boolean;
  onClose: () => void;
}) {
  const blacklist = useBlacklistCandidate();
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!reason.trim()) return;
    await blacklist.mutateAsync({ candidateId, reason });
    setReason("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Blacklist this candidate</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This flags the candidate as do-not-contact in your org, and files the email in the
          platform-wide blacklist registry so other recruiters are warned if this person applies
          elsewhere.
        </Typography>
        <TextField
          label="Reason"
          required
          multiline
          minRows={2}
          fullWidth
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!reason.trim() || blacklist.isPending}
          onClick={handleConfirm}
        >
          {blacklist.isPending ? "Blacklisting…" : "Blacklist"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
