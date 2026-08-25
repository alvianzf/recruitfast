import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  FormControlLabel,
  Grid,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

import {
  useCandidate,
  useDeleteCandidate,
  useUpdateCandidate,
  type CandidateDetail,
  type CandidateUpdateInput,
} from "../api/candidates";
import { useAddCandidateNote, useCandidateNotes } from "../api/notes";
import { useBlacklistCandidate } from "../api/pipeline";
import { useBlacklistStatuses } from "../api/blacklist";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import BlacklistBadge from "../components/BlacklistBadge";
import ParsedDataTable from "../components/ParsedDataTable";
import CvPreviewPanel from "../components/CvPreviewPanel";

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

function EditCandidateDialog({
  candidate,
  open,
  onClose,
}: {
  candidate: CandidateDetail;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateCandidate(candidate.id);
  const [form, setForm] = useState<CandidateUpdateInput>({
    full_name: candidate.full_name,
    email: candidate.email ?? "",
    phone: candidate.phone ?? "",
    source: candidate.source ?? "",
    current_position: candidate.current_position ?? "",
    total_years_experience: candidate.total_years_experience ?? "",
    linkedin_url: candidate.linkedin_url ?? "",
    github_url: candidate.github_url ?? "",
    portfolio_url: candidate.portfolio_url ?? "",
    open_to_other_roles: candidate.open_to_other_roles,
  });

  function field(key: keyof CandidateUpdateInput) {
    return {
      value: (form[key] as string) ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleSave() {
    if (!form.full_name?.trim()) return;
    await update.mutateAsync(form);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Edit candidate</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Full name" required fullWidth autoFocus {...field("full_name")} />
          <TextField label="Email" type="email" fullWidth {...field("email")} />
          <TextField label="Phone" fullWidth {...field("phone")} />
          <TextField label="Source" fullWidth {...field("source")} />
          <TextField label="Position" fullWidth {...field("current_position")} />
          <TextField label="Years of experience" fullWidth {...field("total_years_experience")} />
          <TextField label="LinkedIn URL" fullWidth {...field("linkedin_url")} />
          <TextField label="GitHub URL" fullWidth {...field("github_url")} />
          <TextField label="Portfolio URL" fullWidth {...field("portfolio_url")} />
          <Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.open_to_other_roles}
                  onChange={(e) => setForm((f) => ({ ...f, open_to_other_roles: e.target.checked }))}
                />
              }
              label="Open Profile"
            />
            <Typography variant="caption" color="text.secondary">
              Visible to every recruiter in every organization, not just this tenant/team — the same
              cross-tenant sharing a candidate can opt into themselves via the public application form.
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!form.full_name?.trim() || update.isPending} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteCandidateDialog({
  candidate,
  open,
  onClose,
}: {
  candidate: CandidateDetail;
  open: boolean;
  onClose: () => void;
}) {
  const deleteCandidate = useDeleteCandidate();
  const navigate = useNavigate();

  async function handleConfirm() {
    await deleteCandidate.mutateAsync(candidate.id);
    navigate("/candidates");
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Delete {candidate.full_name}?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          This removes the candidate from every list and pipeline view. This can't be undone from the
          UI.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={deleteCandidate.isPending} onClick={handleConfirm}>
          {deleteCandidate.isPending ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CandidateDetail() {
  const { candidateId = "" } = useParams();
  const { data: candidate, isLoading } = useCandidate(candidateId);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const { data: blacklistStatuses } = useBlacklistStatuses([candidate?.email]);

  if (isLoading || !candidate) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const doc = candidate.current_document;
  const elsewhereStatus = blacklistStatuses?.find((s) => s.email.toLowerCase() === candidate.email?.toLowerCase());

  return (
    <Stack spacing={2}>
      <Breadcrumbs items={[{ label: "Candidates", to: "/candidates" }, { label: candidate.full_name }]} />
      <PageHeader title={candidate.full_name}>
        <BlacklistBadge status={elsewhereStatus} />
        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </PageHeader>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setEditOpen(true);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Edit candidate
        </MenuItem>
        {!candidate.blacklisted && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setBlacklistOpen(true);
            }}
          >
            <ListItemIcon>
              <BlockOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Blacklist candidate
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete candidate
        </MenuItem>
      </Menu>

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
              {doc?.parsed_fields.summary && doc.parsed_fields.summary.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Summary</Typography>
                  <Stack spacing={1} component="ul" sx={{ pl: 2.5, m: 0 }}>
                    {doc.parsed_fields.summary.map((line, i) => (
                      <Typography key={i} component="li" variant="body2">
                        {line}
                      </Typography>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>

            {doc && (
              <>
                {doc.parse_status === "needs_review" && (
                  <Alert severity="warning">
                    Parsed from {doc.original_filename} — review fields before relying on them fully.
                  </Alert>
                )}

                <Paper sx={{ p: 2.5 }}>
                  <CvPreviewPanel candidateId={candidateId} />
                </Paper>

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
          <Stack spacing={2}>
            {doc && (
              <Paper sx={{ p: 1 }}>
                <Accordion disableGutters elevation={0} sx={{ backdropFilter: "none", "&:before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 700 }}>Details</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <ParsedDataTable parsedFields={doc.parsed_fields} />
                  </AccordionDetails>
                </Accordion>
              </Paper>
            )}
            <NotesPanel candidateId={candidateId} />
          </Stack>
        </Grid>
      </Grid>

      <BlacklistDialog candidateId={candidateId} open={blacklistOpen} onClose={() => setBlacklistOpen(false)} />
      <EditCandidateDialog candidate={candidate} open={editOpen} onClose={() => setEditOpen(false)} />
      <DeleteCandidateDialog candidate={candidate} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </Stack>
  );
}
