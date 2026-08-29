import { useState } from "react";
import { Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

import { useAuth } from "../auth/AuthContext";
import { useAssignJob, useClaimJob, type Job } from "../api/jobs";
import { useRecruiters } from "../api/org";
import { useTeams } from "../api/teams";
import { useToast } from "./ToastProvider";

type AssignOption = { kind: "recruiter" | "team"; id: string; label: string };

function AssignDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const { data: recruiters } = useRecruiters();
  const { data: teams } = useTeams();
  const assign = useAssignJob(job.id);
  const { showToast } = useToast();
  const [selected, setSelected] = useState<AssignOption | null>(null);

  const options: AssignOption[] = [
    ...(recruiters ?? []).map((r) => ({ kind: "recruiter" as const, id: r.id, label: r.full_name })),
    ...(teams ?? []).map((t) => ({ kind: "team" as const, id: t.id, label: t.name })),
  ];

  async function handleAssign() {
    if (!selected) return;
    try {
      await assign.mutateAsync(selected.kind === "recruiter" ? { recruiterId: selected.id } : { teamId: selected.id });
      setSelected(null);
      onClose();
    } catch {
      showToast("Could not assign this job. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Assign this job</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={options}
          groupBy={(o) => (o.kind === "recruiter" ? "Recruiters" : "Teams")}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
          onChange={(_, value) => setSelected(value)}
          renderInput={(params) => <TextField {...params} label="Search recruiters or teams" autoFocus sx={{ mt: 1 }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!selected || assign.isPending} onClick={handleAssign}>
          {assign.isPending ? "Assigning…" : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function JobAssignmentControl({ job }: { job: Job }) {
  const { user } = useAuth();
  const claim = useClaimJob();
  const { showToast } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const isOrgAdmin = user?.role === "org_admin";
  const isOpen = job.owner_recruiter_id === null;

  async function handleClaim() {
    try {
      await claim.mutateAsync(job.id);
    } catch {
      showToast("Could not claim this job — it may already be claimed or restricted to another team.", "error");
    }
  }

  return (
    <>
      {isOpen ? (
        <Chip size="small" label={job.team_name ? `Open to ${job.team_name}` : "Unassigned"} color="warning" variant="outlined" />
      ) : job.owner_recruiter_id === user?.id ? (
        <Chip size="small" label="Assigned to you" color="success" variant="outlined" />
      ) : null}

      {/* Admins never do recruiter work — claiming a job for yourself is
          recruiter-only, enforced server-side too. See docs/01. */}
      {isOpen && !isOrgAdmin && (
        <Button size="small" variant="outlined" disabled={claim.isPending} onClick={handleClaim}>
          {claim.isPending ? "Claiming…" : "Claim"}
        </Button>
      )}

      {isOrgAdmin && (
        <Button size="small" variant="outlined" onClick={() => setAssignOpen(true)}>
          {isOpen ? "Assign" : "Reassign"}
        </Button>
      )}

      {isOrgAdmin && <AssignDialog job={job} open={assignOpen} onClose={() => setAssignOpen(false)} />}
    </>
  );
}
