import { useState } from "react";
import {
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";

import { useDeactivateRecruiter, useInviteRecruiter, useReassignJobs, useRecruiters, type Recruiter } from "../api/org";
import PageHeader from "../components/PageHeader";

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteRecruiter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    await invite.mutateAsync({ full_name: fullName, email, password });
    setFullName("");
    setEmail("");
    setPassword("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Invite a recruiter</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField
            label="Initial password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            helperText="No email invites yet — share this with them directly. They can't reset it themselves."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!fullName || !email || !password || invite.isPending}
          onClick={handleSubmit}
        >
          {invite.isPending ? "Inviting…" : "Invite"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReassignDialog({
  recruiter,
  recruiters,
  onClose,
}: {
  recruiter: Recruiter | null;
  recruiters: Recruiter[];
  onClose: () => void;
}) {
  const reassign = useReassignJobs();
  const [targetId, setTargetId] = useState<string | null>(null);

  async function handleSubmit() {
    if (!recruiter || !targetId) return;
    const result = await reassign.mutateAsync({ fromId: recruiter.id, toId: targetId });
    setTargetId(null);
    onClose();
    alert(`Reassigned ${result.reassigned_count} job(s).`);
  }

  const others = recruiters.filter((r) => r.id !== recruiter?.id);

  return (
    <Dialog open={!!recruiter} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Reassign {recruiter?.full_name}'s open jobs</DialogTitle>
      <DialogContent>
        <Autocomplete
          options={others}
          getOptionLabel={(r) => r.full_name}
          onChange={(_, value) => setTargetId(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Reassign to" autoFocus sx={{ mt: 1 }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!targetId || reassign.isPending} onClick={handleSubmit}>
          {reassign.isPending ? "Reassigning…" : "Reassign all"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function OrgRecruiters() {
  const { data: recruiters } = useRecruiters();
  const deactivate = useDeactivateRecruiter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Recruiter | null>(null);
  const [menuState, setMenuState] = useState<{ anchor: HTMLElement; recruiter: Recruiter } | null>(null);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Recruiters"
        action={{ label: "Invite recruiter", icon: <PersonAddOutlinedIcon fontSize="small" />, onClick: () => setInviteOpen(true) }}
      />

      <TableContainer component={Paper} sx={{ backdropFilter: "none" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {recruiters?.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{r.full_name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.role.replace("_", " ")}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={r.status}
                    color={r.status === "active" ? "success" : "default"}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => setMenuState({ anchor: e.currentTarget, recruiter: r })}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu anchorEl={menuState?.anchor} open={!!menuState} onClose={() => setMenuState(null)}>
        <MenuItem
          onClick={() => {
            if (menuState) setReassignTarget(menuState.recruiter);
            setMenuState(null);
          }}
        >
          Reassign their open jobs
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuState) deactivate.mutate(menuState.recruiter.id);
            setMenuState(null);
          }}
        >
          Deactivate
        </MenuItem>
      </Menu>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ReassignDialog recruiter={reassignTarget} recruiters={recruiters ?? []} onClose={() => setReassignTarget(null)} />
    </Stack>
  );
}
