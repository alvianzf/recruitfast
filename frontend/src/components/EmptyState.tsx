import type { ReactNode } from "react";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Stack, Typography } from "@mui/material";

export default function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <Stack spacing={1} sx={{ alignItems: "center", py: 6, px: 2 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "action.hover",
          color: "text.secondary",
        }}
      >
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 360 }}>
          {description}
        </Typography>
      )}
    </Stack>
  );
}
