import { Pagination, Paper, Stack, Typography } from "@mui/material";

import { useFreelanceApplications } from "../api/admin";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { usePagination } from "../hooks/usePagination";

// Registration grants immediate access — there is no approval step to
// review here. This is a read-only visibility list of who self-registered.
// To remove a bad-faith account, deactivate it from Organizations > Users.
export default function AdminFreelanceQueue() {
  const { data: applications, isLoading } = useFreelanceApplications();
  const { page, setPage, paged: pagedApplications, pageCount } = usePagination(applications ?? [], 10);

  return (
    <Stack spacing={3}>
      <PageHeader title="Freelance recruiters" />

      {!isLoading && applications?.length === 0 && (
        <Paper sx={{ p: 2 }}>
          <EmptyState title="No registrations yet" description="Freelance recruiters who self-register will appear here." />
        </Paper>
      )}

      <Stack spacing={2}>
        {pagedApplications.map((app) => (
          <Paper key={app.id} sx={{ p: 2.5 }}>
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
          </Paper>
        ))}
      </Stack>

      {pageCount > 1 && (
        <Stack sx={{ alignItems: "center" }}>
          <Pagination count={pageCount} page={page + 1} onChange={(_, p) => setPage(p - 1)} color="primary" />
        </Stack>
      )}
    </Stack>
  );
}
