import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";

import { useCandidate } from "../api/candidates";
import { useAddCandidateNote, useCandidateNotes } from "../api/notes";
import { useBlacklistCandidate } from "../api/pipeline";
import { useBlacklistStatuses } from "../api/blacklist";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import BlacklistBadge from "../components/BlacklistBadge";

function InfoRow({ label, value }: { label: string; value: string | null }) {
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

function NotesPanel({ candidateId }: { candidateId: string }) {
  const { data: notes } = useCandidateNotes(candidateId);
  const addNote = useAddCandidateNote(candidateId);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"team" | "private">("team");

  async function handleAdd() {
    if (!body.trim()) return;
    await addNote.mutateAsync({ body, visibility });
    setBody("");
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography sx={{ fontWeight: 700, mb: 2 }}>Notes</Typography>
      <Stack spacing={2}>
        <TextField
          label="Add a note"
          multiline
          minRows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          fullWidth
        />
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
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
    </Paper>
  );
}

function BlacklistDialog({
  candidateId,
  open,
  onClose,
}: {
  candidateId: string;
  open: boolean;
  onClose: () => void;
}) {
  const blacklist = useBlacklistCandidate();
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!reason.trim()) return;
    await blacklist.mutateAsync({ candidateId, reason });
    setReason("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Blacklist this candidate</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This flags the candidate as do-not-contact in your org, and files the email in the
          platform-wide blacklist registry so other recruiters are warned if this person applies
          elsewhere.
        </Typography>
        <TextField
          label="Reason"
          required
          multiline
          minRows={2}
          fullWidth
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!reason.trim() || blacklist.isPending}
          onClick={handleConfirm}
        >
          {blacklist.isPending ? "Blacklisting…" : "Blacklist"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CandidateDetail() {
  const { candidateId = "" } = useParams();
  const { data: candidate, isLoading } = useCandidate(candidateId);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const { data: blacklistStatuses } = useBlacklistStatuses([candidate?.email]);

  if (isLoading || !candidate) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const doc = candidate.current_document;
  const skills = doc?.parsed_fields.technical_skills ?? {};
  const hasSkills = Object.values(skills).some((list) => list && list.length > 0);
  const elsewhereStatus = blacklistStatuses?.find((s) => s.email.toLowerCase() === candidate.email?.toLowerCase());

  return (
    <Stack spacing={2}>
      <Breadcrumbs items={[{ label: "Candidates", to: "/candidates" }, { label: candidate.full_name }]} />
      <PageHeader
        title={candidate.full_name}
        action={
          candidate.blacklisted
            ? undefined
            : {
                label: "Blacklist candidate",
                icon: <BlockOutlinedIcon fontSize="small" />,
                onClick: () => setBlacklistOpen(true),
              }
        }
      >
        <BlacklistBadge status={elsewhereStatus} />
      </PageHeader>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2.5 }}>
              <Stack spacing={1}>
                <InfoRow label="Position" value={candidate.current_position} />
                <InfoRow label="Email" value={candidate.email} />
                <InfoRow label="Phone" value={candidate.phone} />
                <InfoRow label="Source" value={candidate.source} />
                <InfoRow label="Experience" value={candidate.total_years_experience} />
              </Stack>
              {candidate.blacklisted && <Alert severity="error" sx={{ mt: 2 }}>Blacklisted (Do Not Contact)</Alert>}
            </Paper>

            {doc && (
              <>
                {doc.parse_status === "needs_review" && (
                  <Alert severity="warning">
                    Parsed from {doc.original_filename} — review fields before relying on them fully.
                  </Alert>
                )}

                {doc.parsed_fields.summary && doc.parsed_fields.summary.length > 0 && (
                  <Paper sx={{ p: 2.5 }}>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Summary</Typography>
                    <Stack spacing={1} component="ul" sx={{ pl: 2.5, m: 0 }}>
                      {doc.parsed_fields.summary.map((line, i) => (
                        <Typography key={i} component="li" variant="body2">
                          {line}
                        </Typography>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {hasSkills && (
                  <Paper sx={{ p: 2.5 }}>
                    <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Technical skills</Typography>
                    <Stack spacing={1.5}>
                      {Object.entries(skills).map(
                        ([category, items]) =>
                          items &&
                          items.length > 0 && (
                            <Stack key={category} spacing={0.75}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase" }}>
                                {category.replace(/_/g, " ")}
                              </Typography>
                              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                                {items.map((skill) => (
                                  <Chip key={skill.name} size="small" label={`${skill.name} · ${skill.years_of_experience}y`} />
                                ))}
                              </Stack>
                            </Stack>
                          ),
                      )}
                    </Stack>
                  </Paper>
                )}

                {doc.parsed_fields.main_projects && doc.parsed_fields.main_projects.length > 0 && (
                  <Paper sx={{ p: 1 }}>
                    <Typography sx={{ fontWeight: 700, p: 1.5, pb: 0.5 }}>Experience</Typography>
                    {doc.parsed_fields.main_projects.map((proj, i) => (
                      <Accordion key={i} disableGutters elevation={0} sx={{ backdropFilter: "none", "&:before": { display: "none" } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Stack>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {proj.project_title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[proj.company_name, proj.position, proj.duration].filter(Boolean).join(" · ")}
                            </Typography>
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={1.5}>
                            {proj.project_description && (
                              <Typography variant="body2">{proj.project_description}</Typography>
                            )}
                            {proj.responsibilities.length > 0 && (
                              <Stack component="ul" sx={{ pl: 2.5, m: 0 }} spacing={0.5}>
                                {proj.responsibilities.map((r, ri) => (
                                  <Typography key={ri} component="li" variant="body2">
                                    {r}
                                  </Typography>
                                ))}
                              </Stack>
                            )}
                            {proj.technologies_used.length > 0 && (
                              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                                {proj.technologies_used.map((t) => (
                                  <Chip key={t} size="small" variant="outlined" label={t} />
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Paper>
                )}

                {doc.parsed_fields.education && doc.parsed_fields.education.length > 0 && (
                  <Paper sx={{ p: 2.5 }}>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Education</Typography>
                    <Stack spacing={1}>
                      {doc.parsed_fields.education.map((edu, i) => (
                        <Stack key={i}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {edu.institution}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[edu.major, edu.year].filter(Boolean).join(" · ")}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {doc.parsed_fields.certifications && doc.parsed_fields.certifications.length > 0 && (
                  <Paper sx={{ p: 2.5 }}>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>Certifications</Typography>
                    <Stack spacing={1}>
                      {doc.parsed_fields.certifications.map((cert, i) => (
                        <Stack key={i}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {cert.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[cert.issuer, cert.year_issued].filter(Boolean).join(" · ")}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                )}
              </>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <NotesPanel candidateId={candidateId} />
        </Grid>
      </Grid>

      <BlacklistDialog candidateId={candidateId} open={blacklistOpen} onClose={() => setBlacklistOpen(false)} />
    </Stack>
  );
}
