import { useState } from "react";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useOpenProfiles, useAttachFromOpenProfile, type OpenProfile } from "../api/screening";
import { useJobs } from "../api/jobs";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

function AttachDialog({ candidate, onClose }: { candidate: OpenProfile | null; onClose: () => void }) {
  const { data: jobs } = useJobs();
  const attach = useAttachFromOpenProfile();
  const [jobId, setJobId] = useState<string | null>(null);

  async function handleAttach() {
    if (!candidate || !jobId) return;
    await attach.mutateAsync({ jobId, candidateId: candidate.id });
    setJobId(null);
    onClose();
  }

  return (
    <Dialog open={!!candidate} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Attach {candidate?.full_name} to a job</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={jobs ?? []}
          getOptionLabel={(j) => j.title}
          onChange={(_, value) => setJobId(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Job" autoFocus sx={{ mt: 1 }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!jobId || attach.isPending} onClick={handleAttach}>
          {attach.isPending ? "Attaching…" : "Attach"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function OpenProfiles() {
  const { data: profiles } = useOpenProfiles();
  const [selected, setSelected] = useState<OpenProfile | null>(null);

  return (
    <Stack spacing={3}>
      <PageHeader title="Open profiles" />
      <Typography variant="body2" color="text.secondary">
        Candidates platform-wide who opted in to be considered for other roles. Attach one to any of your jobs.
      </Typography>

      {profiles?.length === 0 && (
        <Paper sx={{ p: 2 }}>
          <EmptyState title="No open profiles yet" description="Candidates opt in when applying via a job board." />
        </Paper>
      )}

      <Stack spacing={1.5}>
        {profiles?.map((p) => (
          <Paper key={p.id} sx={{ p: 2.5 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}>
              <Stack>
                <Typography sx={{ fontWeight: 600 }}>{p.full_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[p.current_position, p.total_years_experience && `${p.total_years_experience} yrs`]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
              </Stack>
              <Button variant="outlined" size="small" onClick={() => setSelected(p)}>
                Attach to job
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <AttachDialog candidate={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}
