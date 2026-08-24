import { useState } from "react";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

import { useCandidates } from "../api/candidates";
import { useAttachCandidate } from "../api/pipeline";

export default function AttachCandidateDialog({
  jobId,
  open,
  onClose,
}: {
  jobId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: candidates } = useCandidates();
  const attach = useAttachCandidate(jobId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleAttach() {
    if (!selectedId) return;
    await attach.mutateAsync(selectedId);
    setSelectedId(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Attach a candidate to this job</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={candidates ?? []}
          getOptionLabel={(c) => c.full_name}
          onChange={(_, value) => setSelectedId(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Search candidates" autoFocus sx={{ mt: 1 }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!selectedId || attach.isPending} onClick={handleAttach}>
          {attach.isPending ? "Attaching…" : "Attach"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
