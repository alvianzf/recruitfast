import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";

import { useClientMetrics, useClients, useCreateClient, type Client } from "../api/clients";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/ToastProvider";
import { usePagination } from "../hooks/usePagination";

function NewClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setName("");
    setEmail("");
    setContactPerson("");
    setPhone("");
    setNotes("");
  }

  async function handleSubmit() {
    try {
      await create.mutateAsync({
        name,
        email,
        contact_person: contactPerson || null,
        phone: phone || null,
        notes: notes || null,
      });
      showToast("Client added.");
      reset();
      onClose();
    } catch {
      showToast("Could not add the client. Please try again.", "error");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Add a client</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Client name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
          <TextField label="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} fullWidth />
          <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!name.trim() || !email.trim() || create.isPending} onClick={handleSubmit}>
          {create.isPending ? "Adding…" : "Add client"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ClientMetricsDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { data: metrics, isLoading } = useClientMetrics(client?.id ?? null);

  return (
    <Dialog open={!!client} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{client?.name}</DialogTitle>
      <DialogContent>
        {isLoading && (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        )}
        {metrics && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={4}>
              <Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {metrics.job_count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Jobs ({metrics.open_job_count} open)
                </Typography>
              </Stack>
              <Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {metrics.placement_count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active placements
                </Typography>
              </Stack>
            </Stack>
            <Stack>
              <Typography variant="caption" color="text.secondary">
                Placement revenue
              </Typography>
              {metrics.revenue.by_currency.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No signed placements yet.
                </Typography>
              ) : (
                metrics.revenue.by_currency.map((bucket) => (
                  <Typography key={bucket.currency} variant="body1" sx={{ fontWeight: 600 }}>
                    {bucket.currency} {bucket.total.toLocaleString()}
                  </Typography>
                ))
              )}
              {metrics.revenue.total_in_preferred_currency != null && metrics.revenue.by_currency.length > 1 && (
                <Typography variant="body2" color="text.secondary">
                  ≈ {metrics.revenue.preferred_currency} {metrics.revenue.total_in_preferred_currency.toLocaleString()} total
                </Typography>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Clients() {
  const { user } = useAuth();
  const { data: clients, isLoading } = useClients();
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [metricsTarget, setMetricsTarget] = useState<Client | null>(null);
  const { page, setPage, paged: pagedClients, pageSize } = usePagination(clients ?? [], 10);
  const canManage = user?.role === "org_admin";

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Clients"
        subtitle="The companies your org's jobs are worked on behalf of."
        action={canManage ? { label: "Add client", icon: <AddIcon fontSize="small" />, onClick: () => setNewClientOpen(true) } : undefined}
      />

      {!isLoading && clients?.length === 0 && (
        <Paper sx={{ p: 2 }}>
          <EmptyState
            title="No clients yet"
            description={canManage ? "Add your first client to start attaching jobs to them." : "Ask an org admin to add a client."}
          />
        </Paper>
      )}

      {clients && clients.length > 0 && (
        <TableContainer component={Paper} sx={{ backdropFilter: "none" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Contact person</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedClients.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.contact_person || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<BarChartOutlinedIcon fontSize="small" />} onClick={() => setMetricsTarget(c)}>
                      Metrics
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={clients.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[pageSize]}
          />
        </TableContainer>
      )}

      <NewClientDialog open={newClientOpen} onClose={() => setNewClientOpen(false)} />
      <ClientMetricsDialog client={metricsTarget} onClose={() => setMetricsTarget(null)} />
    </Stack>
  );
}
