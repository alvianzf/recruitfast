import { useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import PublicIcon from "@mui/icons-material/Public";
import BusinessIcon from "@mui/icons-material/Business";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { useKnownSkills, useSearchCandidates, type CandidateSearchResult, type SkillFilter } from "../api/candidateSearch";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import CandidateQuickView from "../components/CandidateQuickView";
import AttachToJobDialog from "../components/AttachToJobDialog";

// Sources purely from our own DB — the CV parser already extracts
// per-skill {name, years_of_experience, last_used} into
// candidate_documents.parsed_fields (see backend cv_parser.py). This
// searches that, not any external service.

function emptyFilter(): SkillFilter {
  return { name: "", min_years: null, used_since_year: null, condition_match: "all" };
}

export default function FindCandidates() {
  const { data: knownSkills } = useKnownSkills();
  const search = useSearchCandidates();
  const [filters, setFilters] = useState<SkillFilter[]>([emptyFilter()]);
  const [skillMatch, setSkillMatch] = useState<"all" | "any">("all");
  const [selected, setSelected] = useState<CandidateSearchResult | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  function updateFilter(index: number, patch: Partial<SkillFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addFilter() {
    setFilters((prev) => [...prev, emptyFilter()]);
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function runSearch() {
    const skills = filters.filter((f) => f.name.trim());
    if (!skills.length) return;
    setHasSearched(true);
    search.mutate({ skills, skill_match: skillMatch });
  }

  const results = search.data ?? [];
  const resultIds = useMemo(() => results.map((c) => c.id), [results]);

  const columns: GridColDef<CandidateSearchResult>[] = [
    {
      field: "full_name",
      headerName: "Name",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", height: "100%" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {params.row.full_name}
          </Typography>
          <Chip
            size="small"
            icon={params.row.scope === "public" ? <PublicIcon sx={{ fontSize: 14 }} /> : <BusinessIcon sx={{ fontSize: 14 }} />}
            label={params.row.scope === "public" ? "Open profile" : "Your org"}
            variant="outlined"
          />
        </Stack>
      ),
    },
    { field: "current_position", headerName: "Position", flex: 1, minWidth: 160, valueGetter: (v) => v ?? "" },
    { field: "location", headerName: "Location", flex: 1, minWidth: 150, valueGetter: (v) => v ?? "" },
    {
      field: "total_years_experience",
      headerName: "Experience",
      width: 110,
      valueGetter: (v) => (v ? `${v} yrs` : ""),
    },
    {
      field: "matched_skills",
      headerName: "Matched skills",
      flex: 1.5,
      minWidth: 220,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75, py: 1 }}>
          {params.row.matched_skills.map((s, i) => (
            <Chip
              key={i}
              size="small"
              label={`${s.name}${s.years_of_experience ? ` · ${s.years_of_experience}y` : ""}${s.last_used ? ` · used ${s.last_used}` : ""}`}
            />
          ))}
        </Stack>
      ),
    },
    {
      field: "actions",
      headerName: "",
      width: 190,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <IconButton
            size="small"
            title="Quick view"
            onClick={(e) => {
              e.stopPropagation();
              setQuickViewId(params.row.id);
            }}
          >
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
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
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader title="Find candidates" subtitle="Search your org's candidates and open profiles by tech stack, to reuse for another job." />

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          {filters.map((filter, i) => (
            <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "flex-start", flexWrap: "wrap", rowGap: 1 }}>
              <Autocomplete
                freeSolo
                options={knownSkills ?? []}
                value={filter.name}
                onInputChange={(_, value) => updateFilter(i, { name: value })}
                sx={{ width: 220 }}
                renderInput={(params) => <TextField {...params} size="small" label="Skill / tech stack" />}
              />
              <TextField
                size="small"
                label="Min. years"
                type="number"
                sx={{ width: 110 }}
                slotProps={{ htmlInput: { min: 0 } }}
                value={filter.min_years ?? ""}
                onChange={(e) => updateFilter(i, { min_years: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <TextField
                size="small"
                label="Used since (year)"
                type="number"
                sx={{ width: 140 }}
                slotProps={{ htmlInput: { min: 1990, max: 2100 } }}
                value={filter.used_since_year ?? ""}
                onChange={(e) => updateFilter(i, { used_since_year: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <TextField
                select
                size="small"
                label="Match"
                sx={{ width: 150 }}
                value={filter.condition_match}
                onChange={(e) => updateFilter(i, { condition_match: e.target.value as "all" | "any" })}
              >
                <MenuItem value="all">Years AND used-since</MenuItem>
                <MenuItem value="any">Years OR used-since</MenuItem>
              </TextField>
              <IconButton size="small" disabled={filters.length === 1} onClick={() => removeFilter(i)} sx={{ mt: 0.5 }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={addFilter}>
              Add skill
            </Button>
            {filters.length > 1 && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Match across skills:
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={skillMatch}
                  onChange={(_e, value: "all" | "any" | null) => value && setSkillMatch(value)}
                >
                  <ToggleButton value="all" sx={{ textTransform: "none", px: 1.5 }}>
                    All (AND)
                  </ToggleButton>
                  <ToggleButton value="any" sx={{ textTransform: "none", px: 1.5 }}>
                    Any (OR)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            )}
            <Button
              variant="contained"
              sx={{ ml: "auto" }}
              disabled={!filters.some((f) => f.name.trim()) || search.isPending}
              onClick={runSearch}
            >
              {search.isPending ? "Searching…" : "Search"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {hasSearched && !search.isPending && results.length === 0 && (
        <Paper sx={{ p: 2 }}>
          <EmptyState title="No matches" description="No candidates in your org or the open-profile pool match these filters." />
        </Paper>
      )}

      {results.length > 0 && (
        <Paper sx={{ height: 600, p: 1 }}>
          <DataGrid
            rows={results}
            columns={columns}
            density="compact"
            getRowHeight={() => "auto"}
            pageSizeOptions={[20, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
            onRowClick={(params) => setQuickViewId(params.row.id)}
            sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" }, "& .MuiDataGrid-cell": { py: 1 } }}
          />
        </Paper>
      )}

      {selected && (
        <AttachToJobDialog
          candidateId={selected.id}
          candidateName={selected.full_name}
          open
          useOpenProfileAttach={selected.scope === "public"}
          onClose={() => setSelected(null)}
        />
      )}
      <CandidateQuickView
        candidateIds={resultIds}
        currentId={quickViewId}
        onNavigate={setQuickViewId}
        onClose={() => setQuickViewId(null)}
      />
    </Stack>
  );
}
