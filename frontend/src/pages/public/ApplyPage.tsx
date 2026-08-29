import { useRef, useState } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";

import { useApplyToJob, usePublicJob } from "../../api/publicBoard";
import { JOB_TYPE_LABEL, SENIORITY_LABEL, WORK_MODE_LABEL } from "../../api/jobs";
import Logo from "../../components/Logo";
import RichText from "../../components/RichText";
import { formatRelativeTime } from "../../utils/relativeTime";
import { formatSalary } from "../../utils/formatSalary";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { PUBLIC_BLUE_BACKGROUND } from "./publicStyles";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";

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
  const navigate = useNavigate();
  const { data: job, isLoading, isError } = usePublicJob(jobSlug);
  const apply = useApplyToJob(jobSlug);
  useDocumentMeta(
    job ? `${job.title}${job.org_name ? ` at ${job.org_name}` : ""}: FastRecruit` : "Apply: FastRecruit",
    job
      ? [job.seniority, job.location, formatSalary(job.salary_min, job.salary_max, job.salary_currency), job.overview]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 300)
      : undefined,
  );
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
      <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND }}>
        <PublicNav />
        <Stack sx={{ alignItems: "center", py: 10 }}>
          <CircularProgress sx={{ color: "#ffffff" }} />
        </Stack>
      </Box>
    );
  }

  if (isError || !job) {
    return (
      <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND, display: "flex", flexDirection: "column" }}>
        <PublicNav />
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">This job isn't accepting applications right now.</Typography>
          </Paper>
        </Box>
        <PublicFooter />
      </Box>
    );
  }

  if (submitted) {
    return (
      <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND, display: "flex", flexDirection: "column" }}>
        <PublicNav />
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
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
          </motion.div>
        </Box>
        <PublicFooter />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: PUBLIC_BLUE_BACKGROUND, display: "flex", flexDirection: "column" }}>
      <PublicNav />
      <Stack spacing={3} sx={{ maxWidth: 1320, mx: "auto", py: { xs: 4, md: 8 }, px: 2, flex: 1, width: "100%" }}>
        <Button
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackIcon fontSize="small" />}
          size="small"
          sx={{ alignSelf: "flex-start", color: "#ffffff" }}
        >
          Back
        </Button>

        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
          <Paper
            sx={{
              p: { xs: 3, md: 4 },
              width: { xs: "100%", md: 420 },
              flexShrink: 0,
              position: { md: "sticky" },
              top: { md: 24 },
            }}
          >
            {job.org_name && (
              <Stack
                direction="row"
                spacing={1}
                component={job.board_path ? RouterLink : "div"}
                to={job.board_path ?? undefined}
                sx={{
                  alignItems: "center",
                  mb: 1,
                  width: "fit-content",
                  textDecoration: "none",
                  color: "inherit",
                  ...(job.board_path && { "&:hover": { textDecoration: "underline" } }),
                }}
              >
                <Avatar src={job.org_logo_url ?? undefined} sx={{ width: 24, height: 24 }}>
                  <BusinessOutlinedIcon sx={{ fontSize: 14 }} />
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {job.org_name}
                </Typography>
              </Stack>
            )}
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {job.title}
            </Typography>
            {(job.work_mode || job.location) && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
                <PlaceOutlinedIcon sx={{ fontSize: 16 }} color="action" />
                <Typography variant="body2" color="text.secondary">
                  {[job.work_mode ? WORK_MODE_LABEL[job.work_mode] : null, job.location].filter(Boolean).join(" · ")}
                </Typography>
              </Stack>
            )}
            {(job.seniority || job.job_type) && (
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
                {job.seniority && <Chip size="small" variant="outlined" label={SENIORITY_LABEL[job.seniority]} />}
                {job.job_type && <Chip size="small" variant="outlined" label={JOB_TYPE_LABEL[job.job_type]} />}
              </Stack>
            )}
            {formatSalary(job.salary_min, job.salary_max, job.salary_currency) && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 1 }}>
                <PaidOutlinedIcon sx={{ fontSize: 16 }} color="action" />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                </Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 1, flexWrap: "wrap" }}>
              <PersonOutlinedIcon sx={{ fontSize: 16 }} color="action" />
              <Typography variant="caption" color="text.secondary">
                Posted by {job.posted_by_name} · {formatRelativeTime(job.created_at)}
              </Typography>
            </Stack>
            {job.overview && (
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                {job.overview}
              </Typography>
            )}
            {job.description && (
              <RichText html={job.description} sx={{ mt: 1.5, color: "text.secondary", fontSize: "0.875rem" }} />
            )}
          </Paper>

          <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1, width: "100%", minWidth: 0 }}>
            <Stack spacing={3} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
                render={({ field }) =>
                  q.question_type === "boolean" ? (
                    <TextField
                      select
                      label={q.required ? `${q.question_text} *` : q.question_text}
                      fullWidth
                      {...field}
                    >
                      <MenuItem value="">
                        <em>Select…</em>
                      </MenuItem>
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </TextField>
                  ) : (
                    <TextField
                      label={q.required ? `${q.question_text} *` : q.question_text}
                      type={q.question_type === "number" ? "number" : "text"}
                      fullWidth
                      {...field}
                    />
                  )
                }
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
              color="secondary"
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
      </Stack>
      <PublicFooter />
    </Box>
  );
}
