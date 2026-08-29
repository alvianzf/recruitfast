import { useState } from "react";
import { Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography, useTheme } from "@mui/material";

import { useAttachCandidateToJob } from "../api/pipeline";
import { useAttachFromOpenProfile } from "../api/screening";
import { useJobs } from "../api/jobs";
import { useCandidate } from "../api/candidates";
import { useToast } from "./ToastProvider";
import { getStatusColor } from "../theme";

export default function AttachToJobDialog({
  candidateId,
  candidateName,
  open,
  onClose,
  useOpenProfileAttach = false,
}: {
  candidateId: string;
  candidateName: string;
  open: boolean;
  onClose: () => void;
  // POST /jobs/{id}/placements/from-open-profile/{candidate_id} instead
  // of the ordinary same-tenant attach — required whenever the candidate
  // might belong to a different tenant (Open Profiles: always; Find
  // Candidates: only its "public"-scope rows). The ordinary attach path
  // 404s for a cross-tenant candidate_id (jobs.py's attach_candidate
  // looks it up scoped to the job's own tenant), so picking the wrong
  // one here isn't a UI nicety, it's the difference between working and
  // erroring. See docs/10 "Open profiles".
  useOpenProfileAttach?: boolean;
}) {
  const theme = useTheme();
  const { data: jobs } = useJobs();
  // Same-tenant only — CandidateDetailOut.placements is already scoped
  // to the current user's own org (see docs/02), so a candidate attached
  // cross-tenant via Open Profiles never leaks another org's pipeline
  // context here.
  const { data: candidate } = useCandidate(open ? candidateId : "");
  const attachOrg = useAttachCandidateToJob();
  const attachOpenProfile = useAttachFromOpenProfile();
  const attach = useOpenProfileAttach ? attachOpenProfile : attachOrg;
  const { showToast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);

  function handleClose() {
    setJobId(null);
    onClose();
  }

  async function handleAttach() {
    if (!jobId) return;
    try {
      await attach.mutateAsync({ jobId, candidateId });
      showToast(`${candidateName} attached to the job.`);
      handleClose();
    } catch {
      showToast("Could not attach this candidate. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Attach {candidateName} to a job</DialogTitle>
      <DialogContent>
        {candidate && candidate.placements.length > 0 && (
          <Stack spacing={1} sx={{ mb: 2.5 }}>
            <Typography variant="caption" color="text.secondary">
              Already in the pipeline for {candidate.placements.length} other job
              {candidate.placements.length > 1 ? "s" : ""}:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {candidate.placements.map((p) => (
                <Chip
                  key={p.job_id}
                  size="small"
                  label={`${p.job_title} · ${p.stage_name}`}
                  variant="outlined"
                  sx={{
                    borderColor: getStatusColor(p.status, theme.palette.mode),
                    color: getStatusColor(p.status, theme.palette.mode),
                  }}
                />
              ))}
            </Stack>
          </Stack>
        )}
        <Autocomplete
          options={jobs ?? []}
          getOptionLabel={(j) => j.title}
          onChange={(_, value) => setJobId(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Job" autoFocus sx={{ mt: 1 }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!jobId || attach.isPending} onClick={handleAttach}>
          {attach.isPending ? "Attaching…" : "Attach"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
