import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useCandidates, type Candidate } from "../api/candidates";
import { useAttachCandidate } from "../api/pipeline";
import { useBlacklistStatuses, type BlacklistStatus } from "../api/blacklist";
import BlacklistBadge from "./BlacklistBadge";
import { useToast } from "./ToastProvider";

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
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Candidate | null>(null);
  const { data: blacklistStatuses } = useBlacklistStatuses(candidates?.map((c) => c.email) ?? []);

  const statusByEmail = useMemo(() => {
    const map = new Map<string, BlacklistStatus>();
    blacklistStatuses?.forEach((s) => map.set(s.email.toLowerCase(), s));
    return map;
  }, [blacklistStatuses]);

  const selectedStatus = selected?.email ? statusByEmail.get(selected.email.toLowerCase()) : undefined;
  const selectedIsBlacklisted = !!selectedStatus?.blacklisted;

  async function handleAttach() {
    if (!selected) return;
    try {
      await attach.mutateAsync(selected.id);
      setSelected(null);
      onClose();
    } catch {
      showToast("Could not attach this candidate. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Attach a candidate to this job</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Autocomplete
            options={candidates ?? []}
            getOptionLabel={(c) => c.full_name}
            onChange={(_, value) => setSelected(value)}
            renderOption={(props, option) => {
              const status = option.email ? statusByEmail.get(option.email.toLowerCase()) : undefined;
              return (
                <Box component="li" {...props} key={option.id}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", width: "100%" }}>
                    <Typography sx={{ flex: 1 }} noWrap>
                      {option.full_name}
                    </Typography>
                    <BlacklistBadge status={status} />
                  </Stack>
                </Box>
              );
            }}
            renderInput={(params) => <TextField {...params} label="Search candidates" autoFocus sx={{ mt: 1 }} />}
          />
          {selectedIsBlacklisted && (
            <Alert severity="warning">
              This candidate is blacklisted. Attaching them to this job doesn't remove the flag — review the reason
              (hover the badge above) before proceeding.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color={selectedIsBlacklisted ? "warning" : "primary"}
          disabled={!selected || attach.isPending}
          onClick={handleAttach}
        >
          {attach.isPending ? "Attaching…" : selectedIsBlacklisted ? "Attach anyway" : "Attach"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
