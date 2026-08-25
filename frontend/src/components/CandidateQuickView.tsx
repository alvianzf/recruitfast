import { useEffect, useRef } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";

import { useCandidate, useCandidateCv } from "../api/candidates";

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

// Flattens the parser's nested parsed_fields into field/value rows for the
// quick-view table — this deliberately doesn't try to reproduce the rich,
// sectioned rendering on the full Candidate Detail page (see CandidateDetail.tsx);
// it's meant for a fast scan while browsing, not the primary reading view.
function stringifyParsedValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "object" && value[0] !== null) {
      return value
        .map((item) => Object.values(item as Record<string, unknown>).filter(Boolean).join(" · "))
        .join("; ");
    }
    return value.join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return !!v;
    });
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${stringifyParsedValue(v)}`).join("; ");
  }
  return String(value);
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
  const { data: cv, isLoading: cvLoading, isError: cvError } = useCandidateCv(currentId);

  const prevUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== cv?.url) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    prevUrlRef.current = cv?.url ?? null;
  }, [cv?.url]);
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

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
  const parsedRows = doc
    ? Object.entries(doc.parsed_fields).map(([field, value]) => ({
        field: field.replace(/_/g, " "),
        value: stringifyParsedValue(value),
      }))
    : [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 560 }, backdropFilter: "none" } } }}
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

            {doc && parsedRows.length > 0 && (
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>Parsed Data</Typography>
                <Table size="small">
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow key={row.field}>
                        <TableCell
                          sx={{ fontWeight: 600, verticalAlign: "top", width: 150, textTransform: "capitalize", pl: 0 }}
                        >
                          {row.field}
                        </TableCell>
                        <TableCell sx={{ wordBreak: "break-word" }}>{row.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            )}

            <Stack spacing={1}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontWeight: 700 }}>CV preview</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadOutlinedIcon fontSize="small" />}
                  disabled={!cv}
                  component="a"
                  href={cv?.url}
                  download={cv?.filename}
                >
                  Download
                </Button>
              </Stack>
              {cvLoading ? (
                <Stack sx={{ alignItems: "center", py: 4 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : cvError ? (
                <Alert severity="info">No CV on file for this candidate.</Alert>
              ) : cv ? (
                <iframe
                  title="CV preview"
                  src={cv.url}
                  style={{ width: "100%", height: 480, border: "none", borderRadius: 12 }}
                />
              ) : null}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
