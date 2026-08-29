import { Stack, Tooltip, Typography } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import type { BlacklistStatus } from "../api/blacklist";

// Global, cross-tenant flag — see docs/01 "Blacklist" and
// app/models/blacklist.py on the backend. Only reason + date are ever
// shown; which tenant filed the entry stays private by design.
export default function BlacklistBadge({ status }: { status: BlacklistStatus | undefined }) {
  if (!status?.blacklisted) return null;

  const tooltip = (
    <Stack spacing={0.75} sx={{ py: 0.5 }}>
      {status.entries.map((entry, i) => (
        <Stack key={i} spacing={0.1}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {new Date(entry.created_at).toLocaleDateString()}
          </Typography>
          <Typography variant="body2">{entry.reason}</Typography>
        </Stack>
      ))}
    </Stack>
  );

  return (
    <Tooltip title={tooltip} arrow>
      <WarningAmberOutlinedIcon
        fontSize="small"
        color="error"
        onClick={(e) => e.stopPropagation()}
        sx={{ verticalAlign: "text-bottom", cursor: "default" }}
      />
    </Tooltip>
  );
}
