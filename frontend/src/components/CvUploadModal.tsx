import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { useCvCommit, useCvParsePreview, type CVCommitItem, type CVPreviewItem } from "../api/candidates";
import { useToast } from "./ToastProvider";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_FILES = 50;

interface RowState {
  item: CVPreviewItem;
  resolution: "create" | "skip";
  fullName: string;
  email: string;
  phone: string;
}

function toRowState(item: CVPreviewItem): RowState {
  const fields = (item.parsed_fields ?? {}) as { name?: string; email?: string; phone?: string };
  return {
    item,
    resolution: item.error ? "skip" : item.possible_duplicate ? "skip" : "create",
    fullName: fields.name ?? "",
    email: fields.email ?? "",
    phone: fields.phone ?? "",
  };
}

export default function CvUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = useCvParsePreview();
  const commit = useCvCommit();
  const { showToast } = useToast();

  function handleClose() {
    setRows([]);
    preview.reset();
    commit.reset();
    onClose();
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).slice(0, MAX_FILES - rows.length);
    if (files.length === 0) return;
    try {
      const items = await preview.mutateAsync(files);
      setRows((prev) => [...prev, ...items.map(toRowState)]);
    } catch (err) {
      // Previously this rejection went nowhere — the drop zone just sat
      // there with no feedback, which read as "upload silently broke" and
      // was easy to misattribute to whatever the recruiter did right
      // before it (e.g. cancelling a prior attempt). Root cause was
      // usually nginx's client_max_body_size rejecting an oversized
      // multi-file batch (413) before the request ever reached the app —
      // see docs/09's Limits section.
      const status = (err as { response?: { status?: number } })?.response?.status;
      showToast(
        status === 413
          ? "That batch is too large to upload in one go — try fewer files at once."
          : "Could not upload one or more files. Please try again.",
        "error",
      );
    }
  }

  function updateRow(tempId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.item.temp_id === tempId ? { ...r, ...patch } : r)));
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.item.temp_id !== tempId));
  }

  const validCount = rows.filter((r) => r.resolution === "create" && !r.item.error && r.fullName.trim()).length;

  async function handleCommit() {
    const items: CVCommitItem[] = rows.map((r) => ({
      temp_id: r.item.temp_id,
      filename: r.item.filename,
      resolution: r.item.error ? "skip" : r.resolution,
      full_name: r.fullName || undefined,
      email: r.email || undefined,
      phone: r.phone || undefined,
      current_position: (r.item.parsed_fields as { position?: string } | null)?.position ?? undefined,
      total_years_experience:
        (r.item.parsed_fields as { total_years_experience?: string } | null)?.total_years_experience ?? undefined,
      location: (r.item.parsed_fields as { location?: string } | null)?.location ?? undefined,
      parsed_fields: r.item.parsed_fields,
      parse_confidence: r.item.parse_confidence,
    }));
    await commit.mutateAsync(items);
    handleClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>Add candidates from CVs</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          {commit.isError && <Alert severity="error">Could not import these candidates. Please try again.</Alert>}

          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: isDragOver ? "primary.main" : "divider",
              borderRadius: 3,
              bgcolor: isDragOver ? "action.hover" : "transparent",
              p: 4,
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 120ms ease, background-color 120ms ease",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: "text.secondary", mb: 1 }} />
            <Typography sx={{ fontWeight: 600 }}>Drag CVs here, or click to browse</Typography>
            <Typography variant="body2" color="text.secondary">
              PDF, DOCX — up to 10 MB each, up to {MAX_FILES} files
            </Typography>
          </Box>

          {preview.isPending && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Parsing…
              </Typography>
            </Stack>
          )}

          {rows.length > 0 && (
            <Stack spacing={1.5}>
              {rows.map((row) => (
                <Box
                  key={row.item.temp_id}
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, p: 2 }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                    <DescriptionOutlinedIcon sx={{ color: "text.secondary", mt: 0.5 }} fontSize="small" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {row.item.filename}
                        </Typography>
                        <IconButton size="small" onClick={() => removeRow(row.item.temp_id)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>

                      {row.item.error ? (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          {row.item.error}
                        </Alert>
                      ) : (
                        <>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                            {(row.item.parsed_fields as { position?: string } | null)?.position && (
                              <Chip
                                size="small"
                                label={(row.item.parsed_fields as { position?: string }).position}
                              />
                            )}
                            {row.item.parse_status === "needs_review" && (
                              <Chip size="small" label="Needs review" color="warning" variant="outlined" />
                            )}
                          </Stack>

                          {row.item.possible_duplicate && (
                            <Alert
                              icon={<WarningAmberIcon fontSize="small" />}
                              severity="warning"
                              sx={{ mt: 1 }}
                            >
                              Possibly already exists as {row.item.possible_duplicate.full_name}.
                              <RadioGroup
                                row
                                value={row.resolution}
                                onChange={(e) =>
                                  updateRow(row.item.temp_id, {
                                    resolution: e.target.value as "create" | "skip",
                                  })
                                }
                              >
                                <FormControlLabel value="create" control={<Radio size="small" />} label="Create new anyway" />
                                <FormControlLabel value="skip" control={<Radio size="small" />} label="Skip this file" />
                              </RadioGroup>
                            </Alert>
                          )}

                          <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
                            <TextField
                              size="small"
                              label="Name"
                              value={row.fullName}
                              onChange={(e) => updateRow(row.item.temp_id, { fullName: e.target.value })}
                              fullWidth
                            />
                            <TextField
                              size="small"
                              label="Email"
                              value={row.email}
                              onChange={(e) => updateRow(row.item.temp_id, { email: e.target.value })}
                              fullWidth
                            />
                            <TextField
                              size="small"
                              label="Phone"
                              value={row.phone}
                              onChange={(e) => updateRow(row.item.temp_id, { phone: e.target.value })}
                              fullWidth
                            />
                          </Stack>
                        </>
                      )}
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={validCount === 0 || commit.isPending} onClick={handleCommit}>
          {commit.isPending ? "Adding…" : `Add ${validCount} candidate${validCount === 1 ? "" : "s"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
