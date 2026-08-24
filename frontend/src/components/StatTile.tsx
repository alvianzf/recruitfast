import type { ReactNode } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";

export default function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }} elevation={0}>
      <Stack spacing={1.5}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
