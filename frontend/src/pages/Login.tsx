import { Box, Button, Paper, Stack, TextField, Typography, Link as MuiLink } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function Login() {
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
      <Paper sx={{ p: 4, width: 400, maxWidth: "100%" }}>
        <Stack spacing={3}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            RecruitFast
          </Typography>
          <Stack spacing={2} component="form">
            <TextField label="Email" type="email" autoComplete="email" fullWidth />
            <TextField label="Password" type="password" autoComplete="current-password" fullWidth />
            <Button variant="contained" size="large" type="submit">
              Sign in
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Freelance recruiter?{" "}
            <MuiLink component={RouterLink} to="/register">
              Register here
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
