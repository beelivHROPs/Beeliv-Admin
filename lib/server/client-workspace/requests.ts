/**
 * Client staff requests (docs/contracts/day2-warnings-requests.sql, part B). Pure: no I/O, so it is unit-tested offline
 * (tests/day2-staff-requests.test.cjs). The database re-checks the session, the agreements, the outlet scope, the bounds
 * and every status change; this only bounds the input before any sign-in work and keeps the documented fields of the answer.
 * Shared by the Client routes (/api/client/requests) and the Admin routes (/api/admin/requests/*).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const REQUEST_STATUSES = ["submitted", "under-review", "in-recruitment", "candidates-submitted", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const keysOnly = (r: Rec, allowed: readonly string[]) => Object.keys(r).every((k) => allowed.includes(k));
const iso = (v: unknown) => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : "");

/** A real calendar date ("2026-02-30" is refused). */
function realDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}

export type NewStaffRequest = { outletId: string; role: string; department: string; count: number; resumptionDate: string; reason: string; notes: string };

/**
 * The Client's new request, exactly the documented fields and the database's own bounds (role 2-80, department <= 80,
 * 1-50 people, a real date, reason 2-120, notes <= 1000). Whether the date is in the allowed window (today to a year
 * ahead) is the database's decision, on its own clock. null when anything is off.
 */
export function parseNewStaffRequest(input: unknown): NewStaffRequest | null {
  const r = rec(input);
  if (!r || !keysOnly(r, ["outletId", "role", "department", "count", "resumptionDate", "reason", "notes"])) return null;
  if (typeof r.outletId !== "string" || !UUID.test(r.outletId)) return null;
  const role = typeof r.role === "string" ? r.role.trim() : "";
  const department = r.department === undefined ? "" : typeof r.department === "string" ? r.department.trim() : null;
  const reason = typeof r.reason === "string" ? r.reason.trim() : "";
  const notes = r.notes === undefined ? "" : typeof r.notes === "string" ? r.notes.trim() : null;
  if (role.length < 2 || role.length > 80 || department === null || department.length > 80) return null;
  if (!Number.isSafeInteger(r.count) || (r.count as number) < 1 || (r.count as number) > 50) return null;
  if (!realDate(r.resumptionDate)) return null;
  if (reason.length < 2 || reason.length > 120 || notes === null || notes.length > 1000) return null;
  return { outletId: r.outletId.toLowerCase(), role, department, count: r.count as number, resumptionDate: r.resumptionDate, reason, notes };
}

/** { requestId } and nothing else. */
export function parseRequestId(input: unknown): string | null {
  const r = rec(input);
  if (!r || !keysOnly(r, ["requestId"]) || typeof r.requestId !== "string" || !UUID.test(r.requestId)) return null;
  return r.requestId.toLowerCase();
}

export type StaffRequestUpdate = { requestId: string; expectedRevision: number; status: RequestStatus; message: string | null };

/** Admin status change: a known status, the revision it was read at, and an optional message to the client (<= 1000). */
export function parseStaffRequestUpdate(input: unknown): StaffRequestUpdate | null {
  const r = rec(input);
  if (!r || !keysOnly(r, ["requestId", "expectedRevision", "status", "message"])) return null;
  if (typeof r.requestId !== "string" || !UUID.test(r.requestId)) return null;
  if (!Number.isSafeInteger(r.expectedRevision) || (r.expectedRevision as number) < 1 || (r.expectedRevision as number) > 1_000_000) return null;
  const status = REQUEST_STATUSES.find((s) => s === r.status);
  if (!status) return null;
  if (!(r.message === undefined || r.message === null || typeof r.message === "string")) return null;
  const message = typeof r.message === "string" && r.message.trim() ? r.message.trim() : null;
  if (message && message.length > 1000) return null;
  return { requestId: r.requestId.toLowerCase(), expectedRevision: r.expectedRevision as number, status, message };
}

export type ClientStaffRequest = {
  id: string; reference: string; outletId: string; outletName: string; clientName: string; role: string; department: string; count: number;
  resumptionDate: string; reason: string; notes: string; status: RequestStatus; message: string | null; submittedAt: string; updatedAt: string;
  revision: number; hasUpdate: boolean;
};
export type RequestHistoryEntry = { action: "submitted" | "status_changed" | "message"; from: RequestStatus | null; to: RequestStatus | null; note: string | null; at: string; by: string };
export type AdminStaffRequest = ClientStaffRequest & { clientId: string; requestedBy: string; history: RequestHistoryEntry[] };

const statusOf = (v: unknown): RequestStatus | null => REQUEST_STATUSES.find((s) => s === v) ?? null;

function clientRequest(raw: unknown): ClientStaffRequest | null {
  const s = rec(raw);
  if (!s || !UUID.test(str(s.id)) || !UUID.test(str(s.outletId)) || !realDate(s.resumptionDate)) return null;
  const status = statusOf(s.status);
  const count = Number.isSafeInteger(s.count) && (s.count as number) >= 1 && (s.count as number) <= 50 ? (s.count as number) : null;
  if (!status || count === null || !iso(s.submittedAt)) return null;
  return {
    id: str(s.id), reference: str(s.reference, 40), outletId: str(s.outletId), outletName: str(s.outletName), clientName: str(s.clientName),
    role: str(s.role, 80), department: str(s.department, 80), count, resumptionDate: s.resumptionDate as string, reason: str(s.reason, 120),
    notes: str(s.notes, 1000), status, message: typeof s.message === "string" && s.message ? s.message.slice(0, 1000) : null,
    submittedAt: iso(s.submittedAt), updatedAt: iso(s.updatedAt) || iso(s.submittedAt),
    revision: Number.isSafeInteger(s.revision) && (s.revision as number) >= 1 ? (s.revision as number) : 1, hasUpdate: s.hasUpdate === true,
  };
}

/** The Client's own requests: documented fields only (no requester, no history, no client id). At most 500. */
export function projectClientRequests(items: unknown): ClientStaffRequest[] {
  return (Array.isArray(items) ? items : []).slice(0, 500).map(clientRequest).filter((x): x is ClientStaffRequest => !!x);
}

/** The five reason labels the database serves; anything else is dropped. */
export function projectReasons(items: unknown): string[] {
  return (Array.isArray(items) ? items : []).filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120).slice(0, 20);
}

function historyEntry(raw: unknown): RequestHistoryEntry | null {
  const h = rec(raw);
  const action = h && (["submitted", "status_changed", "message"] as const).find((a) => a === h.action);
  if (!h || !action || !iso(h.at)) return null;
  return { action, from: statusOf(h.from), to: statusOf(h.to), note: typeof h.note === "string" && h.note ? h.note.slice(0, 1000) : null, at: iso(h.at), by: str(h.by) };
}

/** Admin list: the client fields plus client id, requester name and the change history. At most 1000. */
export function projectAdminRequests(items: unknown): AdminStaffRequest[] {
  return (Array.isArray(items) ? items : []).slice(0, 1000).flatMap((raw): AdminStaffRequest[] => {
    const base = clientRequest(raw);
    const s = rec(raw);
    if (!base || !s || !UUID.test(str(s.clientId))) return [];
    const history = (Array.isArray(s.history) ? s.history : []).slice(0, 200).map(historyEntry).filter((x): x is RequestHistoryEntry => !!x);
    return [{ ...base, clientId: str(s.clientId), requestedBy: str(s.requestedBy), history }];
  });
}
