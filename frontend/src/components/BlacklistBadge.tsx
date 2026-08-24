import { useState } from "react";
import { Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import type { BlacklistStatus } from "../api/blacklist";

// Global, cross-tenant flag — see docs/01 "Blacklist" and
// app/models/blacklist.py on the backend. Only reason + date are ever
// shown; which tenant filed the entry stays private by design.
export default function BlacklistBadge({ status }: { status: BlacklistStatus | undefined }) {
  const [open, setOpen] = useState(false);
  if (!status?.blacklisted) return null;

  return (
    <>
      <Chip
        size="small"
        icon={<WarningAmberOutlinedIcon fontSize="small" />}
        label="Blacklisted"
        color="error"
        variant="outlined"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Blacklist history
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pb: 1 }}>
            {status.entries.map((entry, i) => (
              <Stack key={i} spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.created_at).toLocaleDateString()}
                </Typography>
                <Typography variant="body2">{entry.reason}</Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
