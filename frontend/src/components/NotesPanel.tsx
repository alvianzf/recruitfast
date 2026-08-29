import { useState } from "react";
import { Button, Chip, Divider, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { useAddCandidateNote, useCandidateNotes } from "../api/notes";

// "card" (default) wraps itself in a Paper + heading — used on
// CandidateDetail.tsx, sitting alongside other Paper sections. "plain"
// drops both — used inside CandidateQuickView.tsx's Notes tab, where the
// tab label already says "Notes" and the drawer supplies its own padding.
export default function NotesPanel({
  candidateId,
  variant = "card",
}: {
  candidateId: string;
  variant?: "card" | "plain";
}) {
  const { data: notes } = useCandidateNotes(candidateId);
  const addNote = useAddCandidateNote(candidateId);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"team" | "private">("team");

  async function handleAdd() {
    if (!body.trim()) return;
    await addNote.mutateAsync({ body, visibility });
    setBody("");
  }

  const content = (
    <Stack spacing={2}>
      <TextField
        label="Add a note"
        multiline
        minRows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        fullWidth
      />
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <RadioGroup row value={visibility} onChange={(e) => setVisibility(e.target.value as "team" | "private")}>
          <FormControlLabel value="team" control={<Radio size="small" />} label="Team-visible" />
          <FormControlLabel value="private" control={<Radio size="small" />} label="Private to me" />
        </RadioGroup>
        <Button variant="contained" size="small" disabled={!body.trim() || addNote.isPending} onClick={handleAdd}>
          Add note
        </Button>
      </Stack>
      <Divider />
      <Stack spacing={1.5}>
        {notes?.map((note) => (
          <Stack key={note.id} spacing={0.25}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {note.author.full_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(note.created_at).toLocaleString()}
              </Typography>
              {note.visibility === "private" && (
                <Chip
                  size="small"
                  icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
                  label="private to you"
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography variant="body2">{note.body}</Typography>
          </Stack>
        ))}
        {notes?.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No notes yet.
          </Typography>
        )}
      </Stack>
    </Stack>
  );

  if (variant === "plain") return content;

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography sx={{ fontWeight: 700, mb: 2 }}>Notes</Typography>
      {content}
    </Paper>
  );
}
