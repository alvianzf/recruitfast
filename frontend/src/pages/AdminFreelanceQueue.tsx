import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  useApproveFreelanceApplication,
  useFreelanceApplications,
  useRejectFreelanceApplication,
  type FreelanceApplication,
} from "../api/admin";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

function RejectDialog({
  application,
  onClose,
}: {
  application: FreelanceApplication | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const reject = useRejectFreelanceApplication();

  async function handleReject() {
    if (!application) return;
    await reject.mutateAsync({ id: application.id, reason });
    setReason("");
    onClose();
  }

  return (
    <Dialog open={!!application} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Reject {application?.full_name}'s application</DialogTitle>
      <DialogContent>
        <TextField
          label="Reason"
          fullWidth
          multiline
          minRows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          sx={{ mt: 1 }}
          helperText="This account will be deleted — nothing else was created for it yet."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={!reason.trim() || reject.isPending} onClick={handleReject}>
          {reject.isPending ? "Rejecting…" : "Reject & delete account"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminFreelanceQueue() {
  const { data: applications, isLoading } = useFreelanceApplications();
  const approve = useApproveFreelanceApplication();
  const [rejecting, setRejecting] = useState<FreelanceApplication | null>(null);

  return (
    <Stack spacing={3}>
      <PageHeader title="Freelance approval queue" />

      {!isLoading && applications?.length === 0 && (
        <Paper sx={{ p: 2 }}>
          <EmptyState title="Nothing pending" description="No freelance recruiter applications are waiting on you." />
        </Paper>
      )}

      <Stack spacing={2}>
        {applications?.map((app) => (
          <Paper key={app.id} sx={{ p: 2.5 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }}>{app.full_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {app.email}
                  {app.years_experience != null && ` · ${app.years_experience} yrs experience`}
                  {app.specialization && ` · ${app.specialization}`}
                </Typography>
                {app.linkedin_url && (
                  <Typography variant="body2" color="text.secondary">
                    {app.linkedin_url}
                  </Typography>
                )}
                {app.notes && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {app.notes}
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button color="error" onClick={() => setRejecting(app)}>
                  Reject
                </Button>
                <Button variant="contained" disabled={approve.isPending} onClick={() => approve.mutate(app.id)}>
                  Approve
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <RejectDialog application={rejecting} onClose={() => setRejecting(null)} />
    </Stack>
  );
}
