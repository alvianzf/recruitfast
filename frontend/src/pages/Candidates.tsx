import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";

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
import AttachToJobDialog from "../components/AttachToJobDialog";

// Search is a plain keyword box + point-and-click filters, not boolean
// query syntax — junior recruiters found "senior AND (react OR vue)"
// hard to type. See docs/03's Search section.

export default function Candidates() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<{ anchor: HTMLElement; candidate: Candidate } | null>(null);
  const [editTarget, setEditTarget] = useState<Candidate | null>(null);
  const [blacklistTarget, setBlacklistTarget] = useState<Candidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [attachTarget, setAttachTarget] = useState<Candidate | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [blacklistFilter, setBlacklistFilter] = useState<"all" | "blacklisted">("all");
  const { data: candidates, isLoading } = useCandidates();
  const navigate = useNavigate();
  const { data: blacklistStatuses } = useBlacklistStatuses(candidates?.map((c) => c.email) ?? []);
  const candidateIds = useMemo(() => candidates?.map((c) => c.id) ?? [], [candidates]);

  const sources = useMemo(
    () => Array.from(new Set((candidates ?? []).map((c) => c.source).filter((s): s is string => !!s))).sort(),
    [candidates],
  );

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (candidates ?? []).filter((c) => {
      if (q && !`${c.full_name} ${c.current_position ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (blacklistFilter === "blacklisted" && !c.blacklisted) return false;
      return true;
    });
  }, [candidates, search, sourceFilter, blacklistFilter]);

  const hasActiveFilters = !!search || !!sourceFilter || blacklistFilter !== "all";

  function clearFilters() {
    setSearch("");
    setSourceFilter("");
    setBlacklistFilter("all");
  }

  const statusByEmail = useMemo(() => {
    const map = new Map<string, BlacklistStatus>();
    blacklistStatuses?.forEach((s) => map.set(s.email.toLowerCase(), s));
    return map;
  }, [blacklistStatuses]);

  const columns: GridColDef<Candidate>[] = [
    {
      field: "full_name",
      headerName: "Name",
      flex: 1.2,
      minWidth: 160,
      renderCell: (params) => {
        const status = params.row.email ? statusByEmail.get(params.row.email.toLowerCase()) : undefined;
        const blacklisted = !!status?.blacklisted;
        return (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: blacklisted ? "error.main" : "text.primary", fontWeight: 500 }}
              >
                {params.row.full_name}
              </Typography>
            </Box>
            <BlacklistBadge status={status} />
          </Stack>
        );
      },
    },
    { field: "current_position", headerName: "Position", flex: 1, minWidth: 160 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 180 },
    { field: "phone", headerName: "Phone", flex: 0.8, minWidth: 140 },
    { field: "total_years_experience", headerName: "Years exp.", width: 110 },
    { field: "source", headerName: "Source", width: 120 },
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

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates by name, position, or email…"
            sx={{ maxWidth: 480 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1 }}>
            <TextField
              select
              size="small"
              label="Source"
              value={sourceFilter}
              sx={{ minWidth: 160 }}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              {sources.map((source) => (
                <MenuItem key={source} value={source}>
                  {source}
                </MenuItem>
              ))}
            </TextField>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={blacklistFilter}
              onChange={(_e, value: "all" | "blacklisted" | null) => value && setBlacklistFilter(value)}
            >
              <ToggleButton value="all" sx={{ textTransform: "none", px: 1.5 }}>
                All candidates
              </ToggleButton>
              <ToggleButton value="blacklisted" sx={{ textTransform: "none", px: 1.5 }}>
                Blacklisted only
              </ToggleButton>
            </ToggleButtonGroup>
            <Chip
              label="Clear filters"
              size="small"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ height: 600, p: 1 }}>
        <DataGrid
          rows={filteredCandidates}
          columns={columns}
          loading={isLoading}
          density="compact"
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
          slotProps={{ toolbar: { showQuickFilter: false } }}
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
        <MenuItem
          onClick={() => {
            if (menuState) setAttachTarget(menuState.candidate);
            setMenuState(null);
          }}
        >
          <ListItemIcon>
            <PersonAddAlt1OutlinedIcon fontSize="small" />
          </ListItemIcon>
          Attach to job
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
      {attachTarget && (
        <AttachToJobDialog
          candidateId={attachTarget.id}
          candidateName={attachTarget.full_name}
          open
          onClose={() => setAttachTarget(null)}
        />
      )}
    </Stack>
  );
}
