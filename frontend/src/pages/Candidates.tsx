import { useMemo, useState } from "react";
import { IconButton, ListItemIcon, Menu, MenuItem, Paper, Stack, Tooltip } from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

import { useCandidates, type Candidate } from "../api/candidates";
import { useBlacklistStatuses, type BlacklistStatus } from "../api/blacklist";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import CvUploadModal from "../components/CvUploadModal";
import BlacklistBadge from "../components/BlacklistBadge";
import CandidateQuickView from "../components/CandidateQuickView";
import EditCandidateDialog from "../components/EditCandidateDialog";
import BlacklistCandidateDialog from "../components/BlacklistCandidateDialog";
import DeleteCandidateDialog from "../components/DeleteCandidateDialog";

export default function Candidates() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{ anchor: HTMLElement; candidate: Candidate } | null>(null);
  const [editTarget, setEditTarget] = useState<Candidate | null>(null);
  const [blacklistTarget, setBlacklistTarget] = useState<Candidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const { data: candidates, isLoading } = useCandidates();
  const navigate = useNavigate();
  const { data: blacklistStatuses } = useBlacklistStatuses(candidates?.map((c) => c.email) ?? []);
  const candidateIds = useMemo(() => candidates?.map((c) => c.id) ?? [], [candidates]);

  const statusByEmail = useMemo(() => {
    const map = new Map<string, BlacklistStatus>();
    blacklistStatuses?.forEach((s) => map.set(s.email.toLowerCase(), s));
    return map;
  }, [blacklistStatuses]);

  const columns: GridColDef<Candidate>[] = [
    { field: "full_name", headerName: "Name", flex: 1.2, minWidth: 160 },
    { field: "current_position", headerName: "Position", flex: 1, minWidth: 160 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 180 },
    { field: "phone", headerName: "Phone", flex: 0.8, minWidth: 140 },
    { field: "total_years_experience", headerName: "Years exp.", width: 110 },
    { field: "source", headerName: "Source", width: 120 },
    {
      field: "flag",
      headerName: "",
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.email ? <BlacklistBadge status={statusByEmail.get(params.row.email.toLowerCase())} /> : null,
    },
    {
      field: "actions",
      headerName: "",
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row">
          <Tooltip title="Quick view">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setQuickViewId(params.row.id);
              }}
            >
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMenuState({ anchor: e.currentTarget, candidate: params.row });
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Candidates"
        action={{
          label: "Add candidates",
          icon: <UploadFileOutlinedIcon fontSize="small" />,
          onClick: () => setUploadOpen(true),
        }}
      />

      <Paper sx={{ backdropFilter: "none", height: 600, p: 1 }}>
        <DataGrid
          rows={candidates ?? []}
          columns={columns}
          loading={isLoading}
          density="comfortable"
          pageSizeOptions={[20, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
          onRowClick={(params) => navigate(`/app/candidates/${params.id}`)}
          slots={{
            toolbar: GridToolbar,
            noRowsOverlay: () => (
              <EmptyState
                icon={<UploadFileOutlinedIcon />}
                title="No candidates yet"
                description="Upload CVs to add your first candidates."
              />
            ),
          }}
          slotProps={{ toolbar: { showQuickFilter: true } }}
          sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </Paper>

      <Menu anchorEl={menuState?.anchor} open={!!menuState} onClose={() => setMenuState(null)}>
        <MenuItem
          onClick={() => {
            if (menuState) setEditTarget(menuState.candidate);
            setMenuState(null);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Edit candidate
        </MenuItem>
        {!menuState?.candidate.blacklisted && (
          <MenuItem
            onClick={() => {
              if (menuState) setBlacklistTarget(menuState.candidate);
              setMenuState(null);
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
            if (menuState) setDeleteTarget(menuState.candidate);
            setMenuState(null);
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete candidate
        </MenuItem>
      </Menu>

      <CvUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <CandidateQuickView
        candidateIds={candidateIds}
        currentId={quickViewId}
        onNavigate={setQuickViewId}
        onClose={() => setQuickViewId(null)}
      />
      {editTarget && (
        <EditCandidateDialog candidate={editTarget} open onClose={() => setEditTarget(null)} />
      )}
      {blacklistTarget && (
        <BlacklistCandidateDialog candidateId={blacklistTarget.id} open onClose={() => setBlacklistTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteCandidateDialog candidate={deleteTarget} open onClose={() => setDeleteTarget(null)} />
      )}
    </Stack>
  );
}
