import { useMemo, useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";

import { useOpenProfiles, type OpenProfile } from "../api/screening";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import CandidateQuickView from "../components/CandidateQuickView";
import AttachToJobDialog from "../components/AttachToJobDialog";

export default function OpenProfiles() {
  const { data: profiles, isLoading } = useOpenProfiles();
  const [selected, setSelected] = useState<OpenProfile | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const candidateIds = useMemo(() => profiles?.map((p) => p.id) ?? [], [profiles]);

  const columns: GridColDef<OpenProfile>[] = [
    { field: "full_name", headerName: "Name", flex: 1, minWidth: 180 },
    { field: "current_position", headerName: "Position", flex: 1, minWidth: 180, valueGetter: (v) => v ?? "" },
    { field: "location", headerName: "Location", flex: 1, minWidth: 160, valueGetter: (v) => v ?? "" },
    {
      field: "total_years_experience",
      headerName: "Experience",
      width: 130,
      valueGetter: (v) => (v ? `${v} yrs` : ""),
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(params.row);
          }}
        >
          Attach to job
        </Button>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader title="Open profiles" />
      <Typography variant="body2" color="text.secondary">
        Candidates platform-wide who opted in to be considered for other roles. Attach one to any of your jobs.
      </Typography>

      {profiles?.length === 0 ? (
        <Paper sx={{ p: 2 }}>
          <EmptyState title="No open profiles yet" description="Candidates opt in when applying via a job board." />
        </Paper>
      ) : (
        <Paper sx={{ height: 600, p: 1 }}>
          <DataGrid
            rows={profiles ?? []}
            columns={columns}
            loading={isLoading}
            density="compact"
            pageSizeOptions={[20, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            onRowClick={(params) => setQuickViewId(params.row.id)}
            sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
          />
        </Paper>
      )}

      {selected && (
        <AttachToJobDialog
          candidateId={selected.id}
          candidateName={selected.full_name}
          open
          useOpenProfileAttach
          onClose={() => setSelected(null)}
        />
      )}
      <CandidateQuickView
        candidateIds={candidateIds}
        currentId={quickViewId}
        onNavigate={setQuickViewId}
        onClose={() => setQuickViewId(null)}
      />
    </Stack>
  );
}
