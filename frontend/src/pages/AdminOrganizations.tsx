import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import EventSeatOutlinedIcon from "@mui/icons-material/EventSeatOutlined";

import {
  useAdminUsers,
  useCreateOrganization,
  useCreateSuperadmin,
  useOrganizations,
  useRegisterOrgAdmin,
  useUpdateOrgSeats,
  useUpdateUserStatus,
  type AdminUser,
  type Organization,
} from "../api/admin";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import PageHeader from "../components/PageHeader";
import { usePagination } from "../hooks/usePagination";

function NewOrganizationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateOrganization();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  function reset() {
    setName("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
  }

  async function handleSubmit() {
    try {
      await create.mutateAsync({
        name,
        admin_full_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
      });
      showToast("Organization created.");
      reset();
      onClose();
    } catch {
      showToast("Could not create organization. Please try again.", "error");
    }
  }

  const valid = name.trim() && adminName.trim() && adminEmail.trim() && adminPassword.length >= 8;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New organization</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Organization name" autoFocus fullWidth value={name} onChange={(e) => setName(e.target.value)} />
          <Typography variant="caption" color="text.secondary">
            The organization's first admin — they can invite recruiters and manage the workspace from here.
          </Typography>
          <TextField label="Admin full name" fullWidth value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          <TextField label="Admin email" type="email" fullWidth value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          <TextField
            label="Initial password"
            type="password"
            fullWidth
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            helperText="At least 8 characters. No email invites yet — share this with them directly."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || create.isPending} onClick={handleSubmit}>
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditSeatsDialog({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  const update = useUpdateOrgSeats(org?.id ?? "");
  const { showToast } = useToast();
  const [unlimited, setUnlimited] = useState(false);
  const [seats, setSeats] = useState("3");

  // Re-seed local state whenever a different org opens the dialog — this
  // component stays mounted across opens (Dialog's own `open` prop
  // controls visibility), so without this the fields would keep
  // whatever the previously-edited org left behind.
  useEffect(() => {
    if (!org) return;
    setUnlimited(org.max_recruiter_seats === null);
    setSeats(String(org.max_recruiter_seats ?? 3));
  }, [org]);

  async function handleSubmit() {
    try {
      await update.mutateAsync(unlimited ? null : Math.max(1, Number(seats) || 1));
      showToast("Seat limit updated.");
      onClose();
    } catch {
      showToast("Could not update the seat limit. Please try again.", "error");
    }
  }

  return (
    <Dialog open={!!org} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Recruiter seats for {org?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Caps how many active recruiters this org can have — mirrors the /pricing tiers. The org's admin
            seat(s) are separate and never counted against this. Currently using{" "}
            <strong>{org?.active_recruiter_seat_count ?? 0}</strong>.
          </Typography>
          <TextField
            label="Max recruiter seats"
            type="number"
            fullWidth
            disabled={unlimited}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <FormControlLabel
            control={<Checkbox checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />}
            label="Unlimited (Custom plan)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={update.isPending} onClick={handleSubmit}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RegisterOrgAdminDialog({ org, onClose }: { org: Organization | null; onClose: () => void }) {
  const register = useRegisterOrgAdmin(org?.id ?? "");
  const { showToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    try {
      await register.mutateAsync({ full_name: fullName, email, password });
      showToast("Org admin registered.");
      setFullName("");
      setEmail("");
      setPassword("");
      onClose();
    } catch {
      showToast("Could not register admin. Please try again.", "error");
    }
  }

  return (
    <Dialog open={!!org} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Register an admin for {org?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Full name" autoFocus fullWidth value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField label="Email" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Initial password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="At least 8 characters."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!fullName.trim() || !email.trim() || password.length < 8 || register.isPending}
          onClick={handleSubmit}
        >
          {register.isPending ? "Registering…" : "Register"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NewSuperadminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateSuperadmin();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    try {
      await create.mutateAsync({ full_name: fullName, email, password });
      showToast("Superadmin created.");
      setFullName("");
      setEmail("");
      setPassword("");
      onClose();
    } catch {
      showToast("Could not create superadmin. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New superadmin</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Platform-wide access — no tenant, sees no org/candidate content, only account and application management.
          </Typography>
          <TextField label="Full name" autoFocus fullWidth value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField label="Email" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Initial password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="At least 8 characters."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!fullName.trim() || !email.trim() || password.length < 8 || create.isPending}
          onClick={handleSubmit}
        >
          {create.isPending ? "Creating…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OrganizationsPanel() {
  const { data: orgs } = useOrganizations();
  const [registerTarget, setRegisterTarget] = useState<Organization | null>(null);
  const [seatsTarget, setSeatsTarget] = useState<Organization | null>(null);
  const { page, setPage, paged: pagedOrgs, pageSize } = usePagination(orgs ?? [], 10);

  return (
    <Stack spacing={2}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Recruiter seats</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedOrgs.map((org) => (
              <TableRow key={org.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell>
                  <Chip size="small" label={org.status} color={org.status === "active" ? "success" : "default"} variant="outlined" />
                </TableCell>
                <TableCell>
                  {org.active_recruiter_seat_count} / {org.max_recruiter_seats ?? "∞"}
                </TableCell>
                <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                    <Button size="small" startIcon={<EventSeatOutlinedIcon fontSize="small" />} onClick={() => setSeatsTarget(org)}>
                      Seats
                    </Button>
                    <Button size="small" startIcon={<PersonAddOutlinedIcon fontSize="small" />} onClick={() => setRegisterTarget(org)}>
                      Add admin
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {orgs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    No organizations yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={orgs?.length ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
        />
      </TableContainer>

      <RegisterOrgAdminDialog org={registerTarget} onClose={() => setRegisterTarget(null)} />
      <EditSeatsDialog org={seatsTarget} onClose={() => setSeatsTarget(null)} />
    </Stack>
  );
}

function UsersPanel() {
  const { data: users } = useAdminUsers();
  const { user: me } = useAuth();
  const updateStatus = useUpdateUserStatus();
  const { showToast } = useToast();
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  const { page, setPage, paged: pagedUsers, pageSize } = usePagination(users ?? [], 10);

  async function handleToggleStatus(target: AdminUser) {
    try {
      await updateStatus.mutateAsync({ id: target.id, status: target.status === "active" ? "deactivated" : "active" });
      showToast(target.status === "active" ? "User deactivated." : "User activated.");
      setConfirmTarget(null);
    } catch {
      showToast("Could not update this user. Please try again.", "error");
    }
  }

  return (
    <Stack spacing={2}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedUsers.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role.replace("_", " ")}</TableCell>
                <TableCell>{u.tenant_name ?? "—"}</TableCell>
                <TableCell>
                  <Chip size="small" label={u.status.replace("_", " ")} color={u.status === "active" ? "success" : "default"} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  {u.id !== me?.id && (
                    <Button
                      size="small"
                      color={u.status === "active" ? "error" : "primary"}
                      disabled={updateStatus.isPending}
                      onClick={() => (u.status === "active" ? setConfirmTarget(u) : handleToggleStatus(u))}
                    >
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    No users yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={users?.length ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
        />
      </TableContainer>

      <Dialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Deactivate {confirmTarget?.full_name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            They won't be able to sign in until reactivated. This doesn't affect any data they've already created.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmTarget(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={updateStatus.isPending}
            onClick={() => confirmTarget && handleToggleStatus(confirmTarget)}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default function AdminOrganizations() {
  const [tab, setTab] = useState<"organizations" | "users">("organizations");
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newSuperadminOpen, setNewSuperadminOpen] = useState(false);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Platform administration"
        action={
          tab === "organizations"
            ? { label: "New organization", icon: <AddIcon fontSize="small" />, onClick: () => setNewOrgOpen(true) }
            : {
                label: "New superadmin",
                icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
                onClick: () => setNewSuperadminOpen(true),
              }
        }
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab value="organizations" label="Organizations" />
        <Tab value="users" label="Users" />
      </Tabs>
      {tab === "organizations" ? <OrganizationsPanel /> : <UsersPanel />}

      <NewOrganizationDialog open={newOrgOpen} onClose={() => setNewOrgOpen(false)} />
      <NewSuperadminDialog open={newSuperadminOpen} onClose={() => setNewSuperadminOpen(false)} />
    </Stack>
  );
}
