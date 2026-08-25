import { useEffect } from "react";
import { Chip, CircularProgress, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useCandidate } from "../api/candidates";
import ParsedDataTable from "./ParsedDataTable";
import CvPreviewPanel from "./CvPreviewPanel";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

export default function CandidateQuickView({
  candidateIds,
  currentId,
  onNavigate,
  onClose,
}: {
  candidateIds: string[];
  currentId: string | null;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const open = currentId !== null;
  const { data: candidate, isLoading } = useCandidate(currentId ?? "");

  const index = currentId ? candidateIds.indexOf(currentId) : -1;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < candidateIds.length - 1;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(candidateIds[index - 1]);
      if (e.key === "ArrowRight" && hasNext) onNavigate(candidateIds[index + 1]);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, hasPrev, hasNext, index, candidateIds, onNavigate]);

  const doc = candidate?.current_document;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: "100%", sm: 560 }, backdropFilter: "none", backgroundColor: "background.paper" } },
      }}
    >
      <Stack sx={{ height: "100%" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {candidate?.full_name ?? "Quick view"}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <IconButton size="small" disabled={!hasPrev} onClick={() => hasPrev && onNavigate(candidateIds[index - 1])}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", px: 0.5 }}>
              {index >= 0 ? `${index + 1} / ${candidateIds.length}` : ""}
            </Typography>
            <IconButton size="small" disabled={!hasNext} onClick={() => hasNext && onNavigate(candidateIds[index + 1])}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <Divider />

        {isLoading || !candidate ? (
          <Stack sx={{ alignItems: "center", py: 8 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={3} sx={{ p: 2.5, overflowY: "auto", flex: 1 }}>
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 700 }}>Basic Information</Typography>
              <InfoRow label="Position" value={candidate.current_position} />
              <InfoRow label="Email" value={candidate.email} />
              <InfoRow label="Phone" value={candidate.phone} />
              <InfoRow label="Source" value={candidate.source} />
              <InfoRow label="Experience" value={candidate.total_years_experience} />
              {candidate.blacklisted && <Chip size="small" color="error" label="Blacklisted" sx={{ alignSelf: "flex-start", mt: 0.5 }} />}
            </Stack>

            {doc && (
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>Parsed Data</Typography>
                <ParsedDataTable parsedFields={doc.parsed_fields} />
              </Stack>
            )}

            <CvPreviewPanel candidateId={currentId} />
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
