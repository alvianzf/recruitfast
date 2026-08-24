import type { ReactNode } from "react";
import { Button, Stack, Typography } from "@mui/material";

interface PageHeaderAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

export default function PageHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: PageHeaderAction;
  children?: ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        {children}
        {action && (
          <Button variant="contained" startIcon={action.icon} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
