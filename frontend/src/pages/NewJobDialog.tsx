import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
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
import { Controller } from "react-hook-form";
import { isAxiosError } from "axios";

import { useCreateJob, JOB_TYPE_LABEL, SENIORITY_LABEL, WORK_MODE_LABEL } from "../api/jobs";
import { useClients } from "../api/clients";
import { useTeams } from "../api/teams";
import { useMe } from "../api/users";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import RichTextEditor from "../components/RichTextEditor";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  overview: z.string().optional(),
  description: z.string().optional(),
  headcount: z.number().int().min(1, "Must be at least 1"),
  work_mode: z.enum(["remote", "onsite", "hybrid", ""]),
  location: z.string().optional(),
  seniority: z.enum(["entry", "mid", "senior", "lead", "executive", ""]),
  job_type: z.enum(["full_time", "part_time", "contract", "internship", "temporary", ""]),
  salary_min: z.number().int().min(0).optional().or(z.literal(undefined)),
  salary_max: z.number().int().min(0).optional().or(z.literal(undefined)),
  salary_currency: z.string().optional(),
  salary_confidential: z.boolean(),
  team_id: z.string().optional(),
  client_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createJob = useCreateJob();
  const { user } = useAuth();
  const { data: me } = useMe();
  const { data: clients } = useClients();
  const { data: teams } = useTeams();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      headcount: 1,
      work_mode: "",
      location: "",
      seniority: "",
      job_type: "",
      description: "",
      salary_currency: "",
      salary_confidential: false,
      team_id: "",
      client_id: "",
    },
  });

  function handleClose() {
    reset();
    createJob.reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    await createJob.mutateAsync({
      ...values,
      work_mode: values.work_mode || null,
      seniority: values.seniority || null,
      job_type: values.job_type || null,
      salary_min: values.salary_min ?? null,
      salary_max: values.salary_max ?? null,
      salary_currency: values.salary_currency || null,
      team_id: values.team_id || null,
      client_id: values.client_id || null,
    });
    showToast("Job created.");
    handleClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New job</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2}>
            {createJob.isError && (
              <Alert severity="error">
                {isAxiosError(createJob.error) && createJob.error.response?.data?.detail
                  ? createJob.error.response.data.detail
                  : "Could not create the job. Please try again."}
              </Alert>
            )}
            <TextField
              size="small"
              label="Title"
              autoFocus
              fullWidth
              {...register("title")}
              error={!!errors.title}
              helperText={errors.title?.message}
            />
            <TextField size="small" label="Overview" fullWidth {...register("overview")} />
            {me?.tenant_type === "org" && (
              <TextField size="small" select label="Client (optional)" fullWidth defaultValue="" {...register("client_id")}>
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
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <RichTextEditor value={field.value ?? ""} onChange={field.onChange} placeholder="Full job description…" />
                )}
              />
            </Box>
            <Stack direction="row" spacing={2}>
              <TextField size="small" select label="Work mode" fullWidth defaultValue="" {...register("work_mode")}>
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
                {...register("location")}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" select label="Seniority" fullWidth defaultValue="" {...register("seniority")}>
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                {Object.entries(SENIORITY_LABEL).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" select label="Job type" fullWidth defaultValue="" {...register("job_type")}>
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
                label="Salary min (optional)"
                type="number"
                fullWidth
                slotProps={{ htmlInput: { min: 0 } }}
                helperText="Leave blank if you'd rather not disclose salary"
                {...register("salary_min", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <TextField
                size="small"
                label="Salary max (optional)"
                type="number"
                fullWidth
                slotProps={{ htmlInput: { min: 0 } }}
                helperText="Blank = fixed figure"
                {...register("salary_max", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <TextField
                size="small"
                label="Currency"
                placeholder="IDR"
                sx={{ width: 110 }}
                slotProps={{ inputLabel: { shrink: true } }}
                {...register("salary_currency")}
              />
            </Stack>
            <Controller
              name="salary_confidential"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Keep salary confidential (never shown on the public job board)"
                />
              )}
            />
            <TextField
              size="small"
              label="Headcount"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { min: 1 } }}
              {...register("headcount", { valueAsNumber: true })}
              error={!!errors.headcount}
              helperText={errors.headcount?.message ?? "Job auto-closes to Won once this many candidates reach the Signed stage."}
            />
            {user?.role === "org_admin" && (
              <TextField
                size="small"
                select
                label="Assign to team (optional)"
                fullWidth
                defaultValue=""
                helperText="Leave blank to keep it open to the whole org. Admins don't own jobs themselves — assign to a specific recruiter after creating it."
                {...register("team_id")}
              >
                <MenuItem value="">
                  <em>Open to the whole org</em>
                </MenuItem>
                {teams?.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={createJob.isPending}>
            {createJob.isPending ? "Creating…" : "Create job"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
