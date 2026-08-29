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
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PublicIcon from "@mui/icons-material/Public";

import { useCandidate } from "../api/candidates";
import { useBlacklistStatuses } from "../api/blacklist";
import { useDeletePlacement } from "../api/pipeline";
import { useMe } from "../api/users";
import { usePagination } from "../hooks/usePagination";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import BlacklistBadge from "../components/BlacklistBadge";
import StatusChip from "../components/StatusChip";
import ParsedDataTable from "../components/ParsedDataTable";
import CvPreviewPanel from "../components/CvPreviewPanel";
import BlacklistCandidateDialog from "../components/BlacklistCandidateDialog";
import EditCandidateDialog from "../components/EditCandidateDialog";
import DeleteCandidateDialog from "../components/DeleteCandidateDialog";
import AttachToJobDialog from "../components/AttachToJobDialog";
import NotesPanel from "../components/NotesPanel";
import { useToast } from "../components/ToastProvider";

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

export default function CandidateDetail() {
  const { candidateId = "" } = useParams();
  const { data: candidate, isLoading, isError } = useCandidate(candidateId);
  const navigate = useNavigate();
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [detachTarget, setDetachTarget] = useState<{ id: string; jobTitle: string } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const { data: blacklistStatuses } = useBlacklistStatuses([candidate?.email]);
  const detachPlacement = useDeletePlacement();
  const { showToast } = useToast();
  const { data: me } = useMe();
  const {
    page: placementsPage,
    setPage: setPlacementsPage,
    paged: pagedPlacements,
    pageSize: placementsPageSize,
  } = usePagination(candidate?.placements ?? [], 10);

  if (isError) {
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <Typography color="text.secondary">
          Couldn't load this candidate — they may not exist, or you may not have access.
        </Typography>
      </Stack>
    );
  }

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
        <Tooltip
          title={
            candidate.open_to_other_roles
              ? "Visible to every recruiter on the platform"
              : me?.tenant_type === "freelance_org"
                ? "Private to you"
                : "Visible within your organization only"
          }
        >
          <Chip
            size="small"
            variant="outlined"
            icon={candidate.open_to_other_roles ? <PublicIcon sx={{ fontSize: 14 }} /> : <LockOutlinedIcon sx={{ fontSize: 14 }} />}
            label={candidate.open_to_other_roles ? "Public" : "Private"}
          />
        </Tooltip>
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
                <InfoRow label="Location" value={candidate.location} />
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

            <Paper sx={{ p: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700 }}>Job History</Typography>
                <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => setAttachOpen(true)}>
                  Attach to job
                </Button>
              </Stack>
              {candidate.placements.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Not attached to any job yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 0 }}>Job</TableCell>
                      <TableCell>Last stage</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Applied</TableCell>
                      <TableCell>Last moved</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedPlacements.map((p) => (
                      <TableRow key={p.job_id}>
                        <TableCell sx={{ pl: 0, fontWeight: 600 }}>{p.job_title}</TableCell>
                        <TableCell>{p.stage_name}</TableCell>
                        <TableCell>
                          <StatusChip status={p.status} />
                        </TableCell>
                        <TableCell>{new Date(p.applied_at).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(p.last_moved_at).toLocaleDateString()}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Detach from this job">
                            <IconButton
                              size="small"
                              onClick={() => setDetachTarget({ id: p.id, jobTitle: p.job_title })}
                            >
                              <LinkOffIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {candidate.placements.length > 0 && (
                <TablePagination
                  component="div"
                  count={candidate.placements.length}
                  page={placementsPage}
                  onPageChange={(_, p) => setPlacementsPage(p)}
                  rowsPerPage={placementsPageSize}
                  rowsPerPageOptions={[placementsPageSize]}
                />
              )}
            </Paper>
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
      <AttachToJobDialog
        candidateId={candidateId}
        candidateName={candidate.full_name}
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
      />
      <Dialog open={!!detachTarget} onClose={() => setDetachTarget(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Detach from {detachTarget?.jobTitle}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes {candidate.full_name} from this job's pipeline entirely, including their stage history.
            Attaching them again later starts fresh.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDetachTarget(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={detachPlacement.isPending}
            onClick={async () => {
              if (!detachTarget) return;
              try {
                await detachPlacement.mutateAsync(detachTarget.id);
                showToast("Detached.");
              } catch {
                showToast("Could not detach this candidate. Please try again.", "error");
              }
              setDetachTarget(null);
            }}
          >
            {detachPlacement.isPending ? "Detaching…" : "Detach"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
