export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (min === null && max === null) return null;
  const cur = currency?.trim() || "";
  const fmt = (n: number) => `${cur ? cur + " " : ""}${n.toLocaleString("en-US")}`;

  if (min !== null && max !== null && max !== min) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}
