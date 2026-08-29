import { useState, type ChangeEvent } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useUpdateJob, JOB_TYPE_LABEL, SENIORITY_LABEL, WORK_MODE_LABEL, type Job, type UpdateJobInput } from "../api/jobs";
import { useClients } from "../api/clients";
import { useMe } from "../api/users";
import { useToast } from "./ToastProvider";
import RichTextEditor from "./RichTextEditor";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On hold" },
  { value: "won", label: "Won (closed — filled)" },
  { value: "lost", label: "Lost (closed — fell through)" },
];

export default function EditJobDialog({ job, open, onClose }: { job: Job; open: boolean; onClose: () => void }) {
  const update = useUpdateJob(job.id);
  const { showToast } = useToast();
  const { data: me } = useMe();
  const { data: clients } = useClients();
  const [form, setForm] = useState<UpdateJobInput>({
    title: job.title,
    overview: job.overview ?? "",
    description: job.description ?? "",
    headcount: job.headcount,
    work_mode: job.work_mode,
    location: job.location ?? "",
    seniority: job.seniority,
    job_type: job.job_type,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency ?? "",
    salary_confidential: job.salary_confidential,
    status: job.status,
    client_id: job.client_id ?? "",
  });

  function field(key: "title" | "overview" | "description" | "location") {
    return {
      value: (form[key] as string) ?? "",
      onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.title?.trim()) return;
    try {
      const { client_id, ...rest } = form;
      await update.mutateAsync({
        ...rest,
        salary_currency: form.salary_currency || null,
        ...(client_id ? { client_id } : { clear_client: true }),
      });
      showToast("Job updated.");
      onClose();
    } catch {
      showToast("Could not save changes. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Edit job</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField size="small" label="Title" required fullWidth autoFocus {...field("title")} />
          <TextField size="small" label="Overview" fullWidth {...field("overview")} />
          {me?.tenant_type === "org" && (
            <TextField
              size="small"
              select
              label="Client (optional)"
              fullWidth
              value={form.client_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
            >
              <MenuItem value="">
                <em>No client</em>
              </MenuItem>
              {clients?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Description
            </Typography>
            <RichTextEditor
              value={form.description ?? ""}
              onChange={(html) => setForm((f) => ({ ...f, description: html }))}
              placeholder="Full job description…"
            />
          </Box>
          <TextField
            size="small"
            label="Headcount"
            type="number"
            fullWidth
            slotProps={{ htmlInput: { min: 1 } }}
            value={form.headcount ?? 1}
            onChange={(e) => setForm((f) => ({ ...f, headcount: Math.max(1, Number(e.target.value) || 1) }))}
            helperText="Job auto-closes to Won once this many candidates reach the Signed stage."
          />
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              select
              label="Work mode"
              fullWidth
              value={form.work_mode ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, work_mode: (e.target.value || null) as UpdateJobInput["work_mode"] }))}
            >
              <MenuItem value="">
                <em>Not specified</em>
              </MenuItem>
              {Object.entries(WORK_MODE_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Location"
              fullWidth
              placeholder="e.g. Jakarta, or Remote (US)"
              slotProps={{ inputLabel: { shrink: true } }}
              {...field("location")}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              select
              label="Seniority"
              fullWidth
              value={form.seniority ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, seniority: (e.target.value || null) as UpdateJobInput["seniority"] }))}
            >
              <MenuItem value="">
                <em>Not specified</em>
              </MenuItem>
              {Object.entries(SENIORITY_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              select
              label="Job type"
              fullWidth
              value={form.job_type ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, job_type: (e.target.value || null) as UpdateJobInput["job_type"] }))}
            >
              <MenuItem value="">
                <em>Not specified</em>
              </MenuItem>
              {Object.entries(JOB_TYPE_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              label="Salary min"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
              value={form.salary_min ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_min: e.target.value === "" ? null : Number(e.target.value) }))}
            />
            <TextField
              size="small"
              label="Salary max"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 0 } }}
              helperText="Blank = fixed figure"
              value={form.salary_max ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_max: e.target.value === "" ? null : Number(e.target.value) }))}
            />
            <TextField
              size="small"
              label="Currency"
              placeholder="IDR"
              sx={{ width: 110 }}
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.salary_currency ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_currency: e.target.value }))}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!form.salary_confidential}
                onChange={(e) => setForm((f) => ({ ...f, salary_confidential: e.target.checked }))}
              />
            }
            label="Keep salary confidential (never shown on the public job board)"
          />
          <TextField
            size="small"
            select
            label="Status"
            fullWidth
            value={form.status ?? job.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!form.title?.trim() || update.isPending} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
