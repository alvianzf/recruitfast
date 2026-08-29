import type { ReactNode } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";

import { BRAND_PRIMARY_DARK } from "../theme";

export default function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}) {
  const theme = useTheme();

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
            backgroundImage: `radial-gradient(circle at 30% 30%, ${theme.palette.primary.main}, ${BRAND_PRIMARY_DARK})`,
            color: "#ffffff",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
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
