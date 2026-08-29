import { useRef, useState } from "react";
import { Alert, Avatar, Box, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";

import { useUploadImage } from "../api/uploads";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Shared drag-drop-or-URL image picker, used for both the org logo
// (OrgProfile.tsx) and a user's own avatar (Profile.tsx). Either upload a
// file (POST /uploads/image, backed by local disk storage served at
// /media — see backend/app/services/storage.py) or paste an already
// hosted URL, since some orgs already have a logo hosted elsewhere.
export default function ImageUploadField({
  value,
  onChange,
  label,
  shape = "circle",
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  shape?: "circle" | "square";
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    const url = await upload.mutateAsync(file);
    onChange(url);
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar
          src={value || undefined}
          variant={shape === "square" ? "rounded" : "circular"}
          sx={{ width: 64, height: 64, bgcolor: "primary.main" }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {label}
          </Typography>
          <Tabs value={mode} onChange={(_e, v) => setMode(v)} sx={{ minHeight: 32 }}>
            <Tab label="Upload" value="upload" sx={{ minHeight: 32, py: 0.5 }} />
            <Tab label="Paste a URL" value="url" sx={{ minHeight: 32, py: 0.5 }} />
          </Tabs>
        </Box>
      </Stack>

      {mode === "upload" ? (
        <Box
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: "2px dashed",
            borderColor: isDragOver ? "primary.main" : "divider",
            borderRadius: 3,
            bgcolor: isDragOver ? "action.hover" : "transparent",
            p: 3,
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 120ms ease, background-color 120ms ease",
          }}
        >
          <CloudUploadOutlinedIcon color="action" sx={{ fontSize: 28, mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            {upload.isPending ? "Uploading..." : "Drag and drop an image, or click to browse"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            PNG, JPEG, WEBP, or GIF, up to 5MB
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </Box>
      ) : (
        <TextField
          size="small"
          fullWidth
          label="Image URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
        />
      )}

      {upload.isError && <Alert severity="error">Could not upload that image. Please try again.</Alert>}
    </Stack>
  );
}
