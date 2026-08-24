import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Box, Button, Paper, Stack, TextField, Typography, Link as MuiLink } from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";

import { useAuth } from "../auth/AuthContext";
import Logo from "../components/Logo";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
      navigate(from, { replace: true });
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
      }}
    >
      <Paper sx={{ p: 5, width: 420, maxWidth: "100%" }} elevation={0}>
        <Stack spacing={4}>
          <Stack spacing={1} sx={{ alignItems: "center" }}>
            <Logo />
            <Typography variant="body2" color="text.secondary">
              Sign in to your recruiter workspace
            </Typography>
          </Stack>

          {serverError && <Alert severity="error">{serverError}</Alert>}

          <Stack spacing={2.5} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              fullWidth
              {...register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              fullWidth
              {...register("password")}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
            <Button variant="contained" size="large" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Freelance recruiter?{" "}
            <MuiLink component={RouterLink} to="/register" underline="hover">
              Register here
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
