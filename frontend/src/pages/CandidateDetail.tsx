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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

import { useCandidate } from "../api/candidates";
import { useAddCandidateNote, useCandidateNotes } from "../api/notes";
import { useBlacklistStatuses } from "../api/blacklist";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import BlacklistBadge from "../components/BlacklistBadge";
import ParsedDataTable from "../components/ParsedDataTable";
import CvPreviewPanel from "../components/CvPreviewPanel";
import BlacklistCandidateDialog from "../components/BlacklistCandidateDialog";
import EditCandidateDialog from "../components/EditCandidateDialog";
import DeleteCandidateDialog from "../components/DeleteCandidateDialog";

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

export default function CandidateDetail() {
  const { candidateId = "" } = useParams();
  const { data: candidate, isLoading } = useCandidate(candidateId);
  const navigate = useNavigate();
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
      <Breadcrumbs items={[{ label: "Candidates", to: "/app/candidates" }, { label: candidate.full_name }]} />
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

            {candidate.placements.length > 0 && (
              <Paper sx={{ p: 2.5 }}>
                <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Job History</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 0 }}>Job</TableCell>
                      <TableCell>Last stage</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Applied</TableCell>
                      <TableCell>Last moved</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {candidate.placements.map((p) => (
                      <TableRow key={p.job_id}>
                        <TableCell sx={{ pl: 0, fontWeight: 600 }}>{p.job_title}</TableCell>
                        <TableCell>{p.stage_name}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={p.status}
                            color={p.status === "rejected" ? "error" : p.status === "withdrawn" ? "default" : "success"}
                          />
                        </TableCell>
                        <TableCell>{new Date(p.applied_at).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(p.last_moved_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
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

      <BlacklistCandidateDialog candidateId={candidateId} open={blacklistOpen} onClose={() => setBlacklistOpen(false)} />
      <EditCandidateDialog candidate={candidate} open={editOpen} onClose={() => setEditOpen(false)} />
      <DeleteCandidateDialog
        candidate={candidate}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/app/candidates")}
      />
    </Stack>
  );
}
