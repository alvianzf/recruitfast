import { Table, TableBody, TableCell, TableRow } from "@mui/material";

// Flattens the parser's nested parsed_fields into field/value rows — a
// fast-scan raw view, deliberately separate from the rich sectioned
// rendering on CandidateDetail.tsx (Summary/Skills/Experience/Education/
// Certifications cards). Used on both the full Candidate Detail page and
// the Candidates-list Quick View drawer so "show me exactly what the
// parser returned" always looks the same.
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

export default function ParsedDataTable({ parsedFields }: { parsedFields: Record<string, unknown> }) {
  const rows = Object.entries(parsedFields).map(([field, value]) => ({
    field: field.replace(/_/g, " "),
    value: stringifyParsedValue(value),
  }));

  return (
    <Table size="small">
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.field}>
            <TableCell sx={{ fontWeight: 600, verticalAlign: "top", width: 150, textTransform: "capitalize", pl: 0 }}>
              {row.field}
            </TableCell>
            <TableCell sx={{ wordBreak: "break-word" }}>{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
