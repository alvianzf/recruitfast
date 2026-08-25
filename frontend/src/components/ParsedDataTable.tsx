import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloseIcon from "@mui/icons-material/Close";

interface Skill {
  name?: string;
  years_of_experience?: string;
  last_used?: string;
}

interface MainProject {
  company_name?: string | null;
  position?: string | null;
  duration?: string | null;
  project_description?: string | null;
  responsibilities?: string[];
  technologies_used?: string[];
}

// Flattens any other parsed_fields key into field/value rows — a fast-scan
// raw view, deliberately separate from the rich sectioned rendering on
// CandidateDetail.tsx. technical_skills and main_projects get dedicated
// layouts below instead (see TechnicalSkillsTable/MainProjectsTable).
function stringifyParsedValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "object" && value[0] !== null) {
      return value
        .map((item) => Object.values(item as Record<string, unknown>).filter(Boolean).join(" · "))
        .join("; ");
    }
    return value.join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return !!v;
    });
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${stringifyParsedValue(v)}`).join("; ");
  }
  return String(value);
}

function TechnicalSkillsTable({ skills }: { skills: Record<string, Skill[]> }) {
  const rows = Object.values(skills).flatMap((items) => (Array.isArray(items) ? items : []));
  if (rows.length === 0) return null;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ pl: 0 }}>Name</TableCell>
          <TableCell>Years</TableCell>
          <TableCell>Last used</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell sx={{ pl: 0 }}>{r.name ?? "—"}</TableCell>
            <TableCell>{r.years_of_experience ?? "—"}</TableCell>
            <TableCell>{r.last_used ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// One title/value-row table per project — a wide single-row-per-project
// layout (title, company, position, duration, technologies as columns)
// got cut off in the narrower contexts this renders in (the Quick View
// drawer, the Details accordion in the Notes column). Stacking
// field/value rows per project instead reads cleanly at any width.
function MainProjectsTable({ projects }: { projects: MainProject[] }) {
  if (projects.length === 0) return null;

  return (
    <Stack spacing={2}>
      {projects.map((p, i) => {
        const heading = [p.company_name, p.position].filter(Boolean).join(" — ") || "—";
        const rows: { label: string; value: string }[] = [];
        if (p.duration) rows.push({ label: "Duration", value: p.duration });
        if (p.project_description) rows.push({ label: "Description", value: p.project_description });
        if (p.responsibilities && p.responsibilities.length > 0) {
          rows.push({ label: "Responsibilities", value: p.responsibilities.join("; ") });
        }
        if (p.technologies_used && p.technologies_used.length > 0) {
          rows.push({ label: "Technologies", value: p.technologies_used.join(", ") });
        }
        return (
          <Stack key={i} spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {heading}
            </Typography>
            <Table size="small">
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell sx={{ fontWeight: 600, verticalAlign: "top", width: 130, pl: 0 }}>{row.label}</TableCell>
                    <TableCell sx={{ wordBreak: "break-word" }}>{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        );
      })}
    </Stack>
  );
}

function ParsedDataContent({ parsedFields }: { parsedFields: Record<string, unknown> }) {
  const skills = parsedFields.technical_skills as Record<string, Skill[]> | undefined;
  const projects = parsedFields.main_projects as MainProject[] | undefined;

  const otherRows = Object.entries(parsedFields)
    .filter(([field]) => field !== "technical_skills" && field !== "main_projects")
    .map(([field, value]) => ({ field: field.replace(/_/g, " "), value: stringifyParsedValue(value) }));

  return (
    <Stack spacing={2.5}>
      <Table size="small">
        <TableBody>
          {otherRows.map((row) => (
            <TableRow key={row.field}>
              <TableCell sx={{ fontWeight: 600, verticalAlign: "top", width: 150, textTransform: "capitalize", pl: 0 }}>
                {row.field}
              </TableCell>
              <TableCell sx={{ wordBreak: "break-word" }}>{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {skills && Object.values(skills).some((list) => Array.isArray(list) && list.length > 0) && (
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Technical Skills
          </Typography>
          <TechnicalSkillsTable skills={skills} />
        </Stack>
      )}

      {projects && projects.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Main Projects
          </Typography>
          <MainProjectsTable projects={projects} />
        </Stack>
      )}
    </Stack>
  );
}

export default function ParsedDataTable({ parsedFields }: { parsedFields: Record<string, unknown> }) {
  const [expandOpen, setExpandOpen] = useState(false);

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Tooltip title="View larger">
          <IconButton size="small" onClick={() => setExpandOpen(true)}>
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <ParsedDataContent parsedFields={parsedFields} />

      <Dialog open={expandOpen} onClose={() => setExpandOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Parsed Data
          <IconButton size="small" onClick={() => setExpandOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <ParsedDataContent parsedFields={parsedFields} />
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
