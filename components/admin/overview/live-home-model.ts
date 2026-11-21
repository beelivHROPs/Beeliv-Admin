export type HomeMetric = { status: "available"; count: number } | { status: "restricted" | "unavailable"; count: null };
export const HOME_METRICS = [
  { key: "staffPlaced", label: "Staff placed", href: "/admin/staff/directory" },
  { key: "staffUnplaced", label: "Staff not yet placed", href: "/admin/staff/assignments" },
  { key: "activeClients", label: "Clients", href: "/admin/clients" },
  { key: "activeOutlets", label: "Active outlets", href: "/admin/clients" },
  { key: "documentsAwaitingHr", label: "Documents awaiting review", href: "/admin/staff/documents" },
  { key: "pendingInvitations", label: "Pending invitations", href: "/admin/team-access" },
] as const;
export type HomeMetricKey = (typeof HOME_METRICS)[number]["key"];
export type HomeSummary = { generatedAt: string } & Record<HomeMetricKey, HomeMetric>;
function metric(value: unknown): value is HomeMetric {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return m.status === "available" ? Number.isSafeInteger(m.count) && Number(m.count) >= 0
    : (m.status === "restricted" || m.status === "unavailable") && m.count === null;
}
export function parseHomeSummary(value: unknown): HomeSummary | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>, v = body.value;
  if (body.ok !== true || !v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.generatedAt !== "string" || !Number.isFinite(Date.parse(s.generatedAt)) || !HOME_METRICS.every(t => metric(s[t.key]))) return null;
  return Object.fromEntries([["generatedAt", s.generatedAt], ...HOME_METRICS.map(t => [t.key, { ...(s[t.key] as HomeMetric) }])]) as HomeSummary;
}
/** A missing/restricted metric is never a zero. Only the server may report zero. */
export function homeMetricText(value: HomeMetric | undefined): string {
  return value?.status === "available" ? String(value.count) : "\u2014";
}
export function homeMetricNote(value: HomeMetric | undefined): string {
  return !value ? "Not available" : value.status === "restricted" ? "Not in your access" : value.status === "unavailable" ? "Not available" : "Current records";
}
