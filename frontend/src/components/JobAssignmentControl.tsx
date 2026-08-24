import { useState } from "react";
import { Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

import { useAuth } from "../auth/AuthContext";
import { useAssignJob, useClaimJob, type Job } from "../api/jobs";
import { useRecruiters } from "../api/org";

function AssignDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const { data: recruiters } = useRecruiters();
  const assign = useAssignJob(job.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleAssign() {
    if (!selectedId) return;
    await assign.mutateAsync(selectedId);
    setSelectedId(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Assign this job to a recruiter</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={recruiters ?? []}
          getOptionLabel={(r) => r.full_name}
          onChange={(_, value) => setSelectedId(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Search recruiters" autoFocus sx={{ mt: 1 }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!selectedId || assign.isPending} onClick={handleAssign}>
          {assign.isPending ? "Assigning…" : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function JobAssignmentControl({ job }: { job: Job }) {
  const { user } = useAuth();
  const claim = useClaimJob();
  const [assignOpen, setAssignOpen] = useState(false);
  const isOrgAdmin = user?.role === "org_admin";
  const isUnassigned = job.owner_recruiter_id === null;

  return (
    <>
      {isUnassigned ? (
        <Chip size="small" label="Unassigned" color="warning" variant="outlined" />
      ) : job.owner_recruiter_id === user?.id ? (
        <Chip size="small" label="Assigned to you" color="success" variant="outlined" />
      ) : null}

      {isUnassigned && (
        <Button size="small" variant="outlined" disabled={claim.isPending} onClick={() => claim.mutate(job.id)}>
          {claim.isPending ? "Claiming…" : "Claim"}
        </Button>
      )}

      {isOrgAdmin && (
        <Button size="small" variant="outlined" onClick={() => setAssignOpen(true)}>
          {isUnassigned ? "Assign" : "Reassign"}
        </Button>
      )}

      {isOrgAdmin && <AssignDialog job={job} open={assignOpen} onClose={() => setAssignOpen(false)} />}
    </>
  );
}
