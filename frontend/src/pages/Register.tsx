import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { isAxiosError } from "axios";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { api } from "../api/client";
import Logo from "../components/Logo";

const schema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  phone: z.string().optional(),
  linkedin_url: z.string().optional(),
  years_experience: z.string().optional(),
  specialization: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Freelance recruiter self-registration — public entry point into the
// platform-owned Freelance Org, gated by Superadmin approval afterward.
// See docs/01-roles-permissions.md#freelance-recruiter-registration-flow.
export default function Register() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await api.post("/freelance/register", {
        ...values,
        years_experience: values.years_experience ? Number(values.years_experience) : undefined,
      });
      setSubmitted(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.detail) {
        setServerError(err.response.data.detail);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Paper sx={{ p: 5, width: 480, maxWidth: "100%" }} elevation={0}>
        {submitted ? (
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <Logo />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Application submitted
            </Typography>
            <Typography color="text.secondary">
              We'll review your application and email you once it's approved. You can't sign in until then.
            </Typography>
            <MuiLink component={RouterLink} to="/login" underline="hover">
              Back to sign in
            </MuiLink>
          </Stack>
        ) : (
          <Stack spacing={3} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={0.5} sx={{ alignItems: "center" }}>
              <Logo />
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                Register as a freelance recruiter — applications are reviewed before you get access.
              </Typography>
            </Stack>

            {serverError && <Alert severity="error">{serverError}</Alert>}

            <TextField
              label="Full name"
              fullWidth
              {...register("full_name")}
              error={!!errors.full_name}
              helperText={errors.full_name?.message}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              {...register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              {...register("password")}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
            <TextField label="Phone" fullWidth {...register("phone")} />
            <TextField label="LinkedIn / portfolio URL" fullWidth {...register("linkedin_url")} />
            <TextField
              label="Years of recruiting experience"
              type="number"
              fullWidth
              {...register("years_experience")}
            />
            <TextField label="Specialization / niche" select fullWidth defaultValue="" {...register("specialization")}>
              <MenuItem value="tech">Technology</MenuItem>
              <MenuItem value="finance">Finance</MenuItem>
              <MenuItem value="healthcare">Healthcare</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField label="Prior placements (optional)" multiline minRows={3} fullWidth {...register("notes")} />
            <Button variant="contained" size="large" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit application"}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              Already have an account?{" "}
              <MuiLink component={RouterLink} to="/login" underline="hover">
                Sign in
              </MuiLink>
            </Typography>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
