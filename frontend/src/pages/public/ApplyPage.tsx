import { useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import { useApplyToJob, usePublicJob } from "../../api/publicBoard";
import Logo from "../../components/Logo";

const schema = z.object({
  full_name: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(1, "Required"),
  cover_letter: z.string().optional(),
  years_of_experience: z.string().min(1, "Required"),
  linkedin_url: z.string().min(1, "Required"),
  github_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  open_to_other_roles: z.boolean(),
  answers: z.record(z.string(), z.string()),
});

type FormValues = z.infer<typeof schema>;

export default function ApplyPage() {
  const { jobSlug = "" } = useParams();
  const { data: job, isLoading, isError } = usePublicJob(jobSlug);
  const apply = useApplyToJob(jobSlug);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitted, setSubmitted] = useState<{ eligible: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { open_to_other_roles: false, answers: {} },
  });

  async function onSubmit(values: FormValues) {
    if (!cvFile) return;
    const result = await apply.mutateAsync({
      ...values,
      answers: Object.entries(values.answers).map(([question_id, answer]) => ({ question_id, answer })),
      cv: cvFile,
    });
    setSubmitted(result);
  }

  if (isLoading) {
    return (
      <Stack sx={{ alignItems: "center", py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (isError || !job) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">This job isn't accepting applications right now.</Typography>
        </Paper>
      </Box>
    );
  }

  if (submitted) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
        <Paper sx={{ p: 5, width: 480, maxWidth: "100%", textAlign: "center" }}>
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Logo compact />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Application received!
            </Typography>
            <Typography color="text.secondary">
              Thanks for applying to {job.title}. The team will be in touch if there's a fit.
            </Typography>
            <Button component={RouterLink} to={job.board_path} variant="outlined" sx={{ mt: 1 }}>
              Browse other jobs
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", py: { xs: 4, md: 8 }, px: 2 }}>
      <Stack spacing={3} sx={{ maxWidth: 620, mx: "auto" }}>
        <RouterLink to="/" style={{ textDecoration: "none", alignSelf: "center" }}>
          <Logo compact />
        </RouterLink>

        <Paper sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {job.title}
              </Typography>
              {job.overview && (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {job.overview}
                </Typography>
              )}
            </Box>

            {apply.isError && <Alert severity="error">Something went wrong submitting your application. Please try again.</Alert>}

            <Stack direction="row" spacing={2}>
              <TextField
                label="Full name"
                fullWidth
                {...register("full_name")}
                error={!!errors.full_name}
                helperText={errors.full_name?.message}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                {...register("email")}
                error={!!errors.email}
                helperText={errors.email?.message}
              />
              <TextField
                label="Phone"
                fullWidth
                {...register("phone")}
                error={!!errors.phone}
                helperText={errors.phone?.message}
              />
            </Stack>

            <Box
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files[0]) setCvFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: "2px dashed",
                borderColor: isDragOver ? "primary.main" : "divider",
                borderRadius: 3,
                bgcolor: isDragOver ? "action.hover" : "transparent",
                p: 3,
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                hidden
                onChange={(e) => e.target.files?.[0] && setCvFile(e.target.files[0])}
              />
              {cvFile ? (
                <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center" }}>
                  <DescriptionOutlinedIcon fontSize="small" color="action" />
                  <Typography variant="body2">{cvFile.name}</Typography>
                </Stack>
              ) : (
                <>
                  <CloudUploadOutlinedIcon sx={{ fontSize: 30, color: "text.secondary", mb: 1 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Drop your CV here, or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    PDF or DOCX, up to 10 MB
                  </Typography>
                </>
              )}
            </Box>

            <TextField label="Cover letter (optional)" multiline minRows={3} fullWidth {...register("cover_letter")} />

            <TextField
              label="Years of experience"
              type="number"
              fullWidth
              {...register("years_of_experience")}
              error={!!errors.years_of_experience}
              helperText={errors.years_of_experience?.message}
            />
            <TextField
              label="LinkedIn URL"
              fullWidth
              {...register("linkedin_url")}
              error={!!errors.linkedin_url}
              helperText={errors.linkedin_url?.message}
            />
            {job.is_technical_role && <TextField label="GitHub URL (optional)" fullWidth {...register("github_url")} />}
            <TextField label="Portfolio URL (optional)" fullWidth {...register("portfolio_url")} />

            {job.screening_questions.map((q) => (
              <Controller
                key={q.id}
                name={`answers.${q.id}`}
                control={control}
                render={({ field }) => <TextField label={q.question_text} fullWidth {...field} />}
              />
            ))}

            <Controller
              name="open_to_other_roles"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="I'm open for other roles with other companies"
                />
              )}
            />

            <Button
              variant="contained"
              size="large"
              type="submit"
              disabled={!cvFile || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {isSubmitting ? "Submitting…" : "Submit application"}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
