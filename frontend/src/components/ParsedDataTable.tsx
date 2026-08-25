import { Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

interface Skill {
  name?: string;
  years_of_experience?: string;
  last_used?: string;
}

interface MainProject {
  project_title?: string;
  company_name?: string | null;
  position?: string | null;
  duration?: string | null;
  project_description?: string | null;
  technologies_used?: string[];
}

// Flattens any other parsed_fields key into field/value rows — a fast-scan
// raw view, deliberately separate from the rich sectioned rendering on
// CandidateDetail.tsx. technical_skills and main_projects get dedicated
// tables below instead (see TechnicalSkillsTable/MainProjectsTable) since
// a flattened single cell reads badly for those two array-of-object
// sections specifically.
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
  const rows = Object.entries(skills).flatMap(([category, items]) =>
    (Array.isArray(items) ? items : []).map((item) => ({ category: category.replace(/_/g, " "), ...item })),
  );
  if (rows.length === 0) return null;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ pl: 0 }}>Category</TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Years</TableCell>
          <TableCell>Last used</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell sx={{ textTransform: "capitalize", pl: 0 }}>{r.category}</TableCell>
            <TableCell>{r.name ?? "—"}</TableCell>
            <TableCell>{r.years_of_experience ?? "—"}</TableCell>
            <TableCell>{r.last_used ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MainProjectsTable({ projects }: { projects: MainProject[] }) {
  if (projects.length === 0) return null;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ pl: 0 }}>Project</TableCell>
          <TableCell>Company</TableCell>
          <TableCell>Position</TableCell>
          <TableCell>Duration</TableCell>
          <TableCell>Technologies</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {projects.map((p, i) => (
          <TableRow key={i}>
            <TableCell sx={{ pl: 0, fontWeight: 600 }}>{p.project_title ?? "—"}</TableCell>
            <TableCell>{p.company_name ?? "—"}</TableCell>
            <TableCell>{p.position ?? "—"}</TableCell>
            <TableCell>{p.duration ?? "—"}</TableCell>
            <TableCell sx={{ wordBreak: "break-word" }}>{(p.technologies_used ?? []).join(", ") || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ParsedDataTable({ parsedFields }: { parsedFields: Record<string, unknown> }) {
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
