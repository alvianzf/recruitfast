import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

// Freelance recruiter self-registration — public entry point into the
// platform-owned Freelance Org, gated by Superadmin approval afterward.
// See docs/01-roles-permissions.md#freelance-recruiter-registration-flow.
export default function Register() {
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
      <Paper sx={{ p: 4, width: 480, maxWidth: "100%" }}>
        <Stack spacing={3} component="form">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Register as a freelance recruiter
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Applications are reviewed by our team before you get access.
            </Typography>
          </Box>
          <TextField label="Full name" fullWidth required />
          <TextField label="Email" type="email" fullWidth required />
          <TextField label="Phone" fullWidth />
          <TextField label="LinkedIn / portfolio URL" fullWidth />
          <TextField label="Years of recruiting experience" type="number" fullWidth />
          <TextField label="Specialization / niche" select fullWidth defaultValue="">
            <MenuItem value="tech">Technology</MenuItem>
            <MenuItem value="finance">Finance</MenuItem>
            <MenuItem value="healthcare">Healthcare</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
          <TextField label="Prior placements (optional)" multiline minRows={3} fullWidth />
          <Button variant="contained" size="large" type="submit">
            Submit application
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
