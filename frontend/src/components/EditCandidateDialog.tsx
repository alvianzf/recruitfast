import { useState, type ChangeEvent } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { useUpdateCandidate, type Candidate, type CandidateUpdateInput } from "../api/candidates";
import { useAuth } from "../auth/AuthContext";
import { useMe } from "../api/users";
import { useToast } from "./ToastProvider";

export default function EditCandidateDialog({
  candidate,
  open,
  onClose,
}: {
  candidate: Candidate;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateCandidate(candidate.id);
  const { showToast } = useToast();
  const { user } = useAuth();
  const { data: me } = useMe();
  const canRevokeOpenProfile = candidate.open_to_other_roles ? user?.role === "superadmin" : true;
  // Freelance recruiters have no team, and their candidates are private
  // to them by default (not shared org-wide the way an Org tenant's
  // are) — "not just this tenant/team" was actively wrong for them, not
  // just unclear. Give each context its own accurate baseline.
  const isFreelance = me?.tenant_type === "freelance_org";
  const [form, setForm] = useState<CandidateUpdateInput>({
    full_name: candidate.full_name,
    email: candidate.email ?? "",
    phone: candidate.phone ?? "",
    source: candidate.source ?? "",
    current_position: candidate.current_position ?? "",
    total_years_experience: candidate.total_years_experience ?? "",
    location: candidate.location ?? "",
    linkedin_url: candidate.linkedin_url ?? "",
    github_url: candidate.github_url ?? "",
    portfolio_url: candidate.portfolio_url ?? "",
    open_to_other_roles: candidate.open_to_other_roles,
  });

  function field(key: keyof CandidateUpdateInput) {
    return {
      value: (form[key] as string) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.full_name?.trim()) return;
    try {
      await update.mutateAsync(form);
      showToast("Candidate updated.");
      onClose();
    } catch {
      showToast("Could not save changes. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Edit candidate</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Full name" required fullWidth autoFocus {...field("full_name")} />
          <TextField label="Email" type="email" fullWidth {...field("email")} />
          <TextField label="Phone" fullWidth {...field("phone")} />
          <TextField label="Source" fullWidth {...field("source")} />
          <TextField label="Position" fullWidth {...field("current_position")} />
          <TextField label="Location" fullWidth {...field("location")} />
          <TextField label="Years of experience" fullWidth {...field("total_years_experience")} />
          <TextField label="LinkedIn URL" fullWidth {...field("linkedin_url")} />
          <TextField label="GitHub URL" fullWidth {...field("github_url")} />
          <TextField label="Portfolio URL" fullWidth {...field("portfolio_url")} />
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.open_to_other_roles}
                  disabled={!canRevokeOpenProfile}
                  onChange={(e) => setForm((f) => ({ ...f, open_to_other_roles: e.target.checked }))}
                />
              }
              label={isFreelance ? "Public" : "Open Profile"}
            />
            <Typography variant="caption" color="text.secondary">
              {canRevokeOpenProfile
                ? isFreelance
                  ? "Private by default: only you can see this candidate. Turning this on makes them Public, visible to every recruiter on the platform, the same opt-in a candidate can make themselves on the public application form."
                  : "Visible to every recruiter in every organization on the platform, not just yours, the same cross-tenant sharing a candidate can opt into themselves via the public application form."
                : "This candidate opted in to being visible platform-wide. Only a superadmin can turn this back off, since it isn't a recruiter's choice to revoke."}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!form.full_name?.trim() || update.isPending} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
