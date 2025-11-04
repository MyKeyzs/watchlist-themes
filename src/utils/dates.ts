// Normalize like "10/29" or "10-29" → "10-29"; returns "" if missing.
export function normalizeToYYYYMMDD(input?: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/); // MM/DD or M/D
  if (!m) return s; // already normalized or different format
  const mm = String(Number(m[1])).padStart(2, "0");
  const dd = String(Number(m[2])).padStart(2, "0");
  // keep your display style consistent; if you want "10/29", change the joiner
  return `${mm}-${dd}`;
}