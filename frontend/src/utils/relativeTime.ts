const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(isoDate: string): string {
  const seconds = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return "just now";

  for (const [unit, unitSeconds] of UNITS) {
    if (abs >= unitSeconds) {
      return rtf.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return "just now";
}
