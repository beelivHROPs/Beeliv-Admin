/**
 * LIVE workforce adapter: the approved Scheduling and Attendance screens on REAL rosters and check-ins
 * (/api/admin/workforce/*, docs/contracts/workforce-shifts-attendance.sql), leave (workforce-leave.sql) and warnings
 * (day2-warnings-requests.sql, part A). Attendance corrections and unpublish are not connected yet: those calls reject plainly.
 */
import type { AdapterEvent } from "../adapter";
import { RestrictedError } from "../adapter";
import type { WorkforceAdapter } from "./adapter";
import type {
  AttendanceDetail, AttendancePage, AttendanceRow, AttendanceStatus, AttendanceTab, LeavePage, LeaveRow, LeaveStatus, LeaveTab, ScopeFacets, ShiftConflict, ShiftRow, ShiftState,
  StaffLeaveHistory, TimeOffResult, WarningDetail, WarningRow, WarningsPage, WarningStatus, WarningTab, WeekRoster,
} from "./types";
import { addDays, startOfWeek, todayISO } from "@/lib/client/format";

/** Standard hospitality sections (lead 2026-11-24: Section was empty when a placement had no department). Recorded departments come first. */
const STANDARD_SECTIONS = ["Kitchen", "Bar", "Floor service", "Front desk", "Housekeeping", "Security", "Support", "Admin"];

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const NOT_CONNECTED = "This isn't connected yet.";
const REASON: Record<string, string> = {
  note_required: "Add a short reason first.",
  invalid_transition: "This request has already been decided. Reload to see it.",
  stale: "This shift was changed by someone else. Reload the week and try again.",
  not_placed: "This person isn't placed at this outlet right now, so they can't be scheduled here.",
  already_worked: "This shift has already been worked, so it can't be removed.",
  invalid_request: "Check the shift details and try again.",
};

/** Per-action wording where the same refusal code means something specific to that action. */
const ACTION_REASON: Record<string, Record<string, string>> = {
  "shift-save": { invalid_request: "Shifts can only be added or changed from yesterday onwards (up to 120 days ahead). Check the date and times." },
  "leave-decide": { stale: "This request was changed by someone else. Reload and try again." },
  "warning-issue": { invalid_request: "Check the record. The effective date can be up to 60 days back or 7 days ahead." },
  "warning-withdraw": { invalid_request: "Add a reason of at least 3 characters.", stale: "This record was changed by someone else. Reload and try again.", invalid_transition: "This record has already been withdrawn." },
};

async function call(action: string, body: Rec): Promise<Rec> {
  const res = await fetch(`/api/admin/workforce/${action}`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = rec(await res.json().catch(() => null));
  if (j?.ok === true) return j;
  const reason = str(j?.reason);
  if (reason === "no_access" || reason === "unauthenticated" || reason === "forbidden" || reason === "mfa_required") throw new RestrictedError();
  throw new Error(ACTION_REASON[action]?.[reason] ?? REASON[reason] ?? "This could not be completed. Please try again.");
}

const listeners = new Set<(e: AdapterEvent) => void>();
const changed = () => { for (const l of listeners) l("reset"); };
const revisions = new Map<string, number>();
let outletsCache: { at: number; facets: ScopeFacets; canManage: boolean } | null = null;

async function outlets() {
  if (outletsCache && Date.now() - outletsCache.at < 60_000) return outletsCache;
  const r = await call("outlets", {});
  const list = arr(r.outlets).map(rec).filter((x): x is Rec => !!x);
  const clients = [...new Map(list.map((o) => [str(o.clientId), { id: str(o.clientId), name: str(o.clientName) }])).values()];
  outletsCache = { at: Date.now(), facets: { clients, outlets: list.map((o) => ({ id: str(o.outletId), clientId: str(o.clientId), name: str(o.outletName) })) }, canManage: r.canManage === true };
  return outletsCache;
}

function shiftRow(raw: unknown): ShiftRow | null {
  const s = rec(raw);
  if (!s) return null;
  const staff = rec(s.staff) ?? {};
  revisions.set(str(s.id), Number(s.revision) || 1);
  return {
    id: str(s.id), date: str(s.date), staff: { id: str(staff.id), name: str(staff.name) }, role: str(s.role), section: str(s.section),
    start: str(s.start), end: str(s.end), breakMins: Number(s.breakMins) || 0, state: (["published", "draft", "changed", "removing"].includes(str(s.state)) ? str(s.state) : "draft") as ShiftState,
    createdBy: str(s.createdBy), lastEditedBy: str(s.lastEditedBy), lastEditedAt: str(s.lastEditedAt),
    conflicts: arr(s.conflicts).map(rec).filter((c): c is Rec => !!c).map((c) => ({ id: str(c.id), kind: "double-booking", label: str(c.label) })) as ShiftConflict[],
  };
}

async function roster(outletId: string, weekStart: string): Promise<WeekRoster> {
  const r = await call("roster", { outletId, weekStart });
  const w = rec(r.roster) ?? {};
  const shifts = arr(w.shifts).map(shiftRow).filter((x): x is ShiftRow => !!x);
  const staff = arr(w.staff).map(rec).filter((x): x is Rec => !!x).map((p) => ({ id: str(p.id), name: str(p.name), role: str(p.role), section: str(p.section) }));
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
  const manage = r.canManage === true;
  return {
    weekStart, outletId, outlet: str(w.outlet), client: str(w.client), shifts,
    unpublishedCount: Number(w.unpublishedCount) || 0, lastPublishedAt: str(w.lastPublishedAt) || null, lastPublishedBy: str(w.lastPublishedBy) || null,
    staff, history: [], sections: uniq([...staff.map((s) => s.section), ...shifts.map((s) => s.section), ...STANDARD_SECTIONS]), roles: uniq([...staff.map((s) => s.role), ...shifts.map((s) => s.role)]),
    canCopyLastWeek: manage && w.hasLastWeek === true, published: shifts.length > 0 && (Number(w.unpublishedCount) || 0) === 0,
    createdBy: str(w.lastPublishedBy), createdAt: str(w.lastPublishedAt), lastEditedBy: shifts[0]?.lastEditedBy ?? "", lastEditedAt: shifts[0]?.lastEditedAt ?? "",
    canCreateSchedule: manage, canPublishSchedule: manage,
  };
}
const lastWeek = new Map<string, string>();

/* ---------- attendance ---------- */
let lastRows: AttendanceRow[] = [];
function attendanceRow(raw: unknown): AttendanceRow | null {
  const a = rec(raw);
  if (!a) return null;
  const staff = rec(a.staff) ?? {};
  const status = (["present", "late", "absent", "not-yet"].includes(str(a.status)) ? str(a.status) : "not-yet") as AttendanceStatus;
  return {
    id: str(a.id), date: str(a.date), staff: { id: str(staff.id), name: str(staff.name) }, clientId: str(a.clientId), client: str(a.client),
    outletId: str(a.outletId), outlet: str(a.outlet), role: str(a.role), shiftLabel: `${str(a.shiftStart)}-${str(a.shiftEnd)}`,
    shiftStart: str(a.shiftStart), shiftEnd: str(a.shiftEnd), checkIn: str(a.checkIn) || null, checkOut: str(a.checkOut) || null,
    status, flags: a.noCheckOut === true ? ["no-check-out"] : [],
  };
}

/* ---------- leave (workforce-leave.sql) ---------- */
let leaveCache: { rows: LeaveRow[]; canApprove: boolean; types: string[] } | null = null;
const leaveRevisions = new Map<string, number>();
function leaveRow(raw: unknown): LeaveRow | null {
  const l = rec(raw);
  if (!l) return null;
  const staff = rec(l.staff) ?? {};
  leaveRevisions.set(str(l.id), Number(l.revision) || 1);
  return {
    id: str(l.id), staff: { id: str(staff.id), name: str(staff.name) }, clientId: str(l.clientId), client: str(l.client) || "Not placed",
    outletId: str(l.outletId), outlet: str(l.outlet), type: str(l.type), startDate: str(l.startDate), endDate: str(l.endDate),
    days: Number(l.days) || 0, balance: null, status: (["pending", "approved", "declined", "cancelled"].includes(str(l.status)) ? str(l.status) : "pending") as LeaveStatus,
    submittedAt: str(l.submittedAt), decidedBy: str(l.decidedBy) || null, decidedAt: str(l.decidedAt) || null, reason: str(l.reason) || null,
    decisionNote: str(l.decisionNote) || null, attachmentName: null,
    history: arr(l.history).map(rec).filter((h): h is Rec => !!h).map((h) => ({ id: str(h.id), action: str(h.action), actor: str(h.actor), at: str(h.at), previous: null, next: null, note: str(h.note) || null })),
  };
}
async function leaves(force = false) {
  if (leaveCache && !force) return leaveCache;
  const r = await call("leave", {});
  leaveCache = { rows: arr(r.items).map(leaveRow).filter((x): x is LeaveRow => !!x), canApprove: r.canApprove === true, types: arr(r.types).map(str) };
  return leaveCache;
}
/** Approved leave covering a date (for attendance "on leave" and "who is off"). */
const onLeave = (rows: LeaveRow[], personId: string, date: string) => rows.some((l) => l.status === "approved" && l.staff.id === personId && l.startDate <= date && l.endDate >= date);
async function decide(id: string, decision: "approve" | "decline", note: string) {
  await call("leave-decide", { leaveId: id, expectedRevision: leaveRevisions.get(id), decision, note });
  changed();
  const fresh = await leaves(true);
  const row = fresh.rows.find((l) => l.id === id);
  if (!row) throw new Error("Reload to see this request.");
  return row;
}


/* ---------- warnings (day2-warnings-requests.sql, part A) ---------- */
type WarnStaff = { id: string; name: string; client: string; outlet: string; clientId: string; outletId: string };
type WarningsData = { items: WarningDetail[]; canIssue: boolean; types: string[]; severities: string[]; staff: WarnStaff[] };
let warningsCache: WarningsData | null = null;
const warningRevisions = new Map<string, number>();
const WARNING_STATUSES: WarningStatus[] = ["issued", "acknowledged", "withdrawn"];

/** Server item -> the approved WarningDetail. "disputed" is never produced (no dispute action exists). History is built from the stored dates only. */
export function warningOf(raw: unknown, canIssue: boolean): WarningDetail | null {
  const w = rec(raw);
  if (!w || !str(w.id)) return null;
  const status = (WARNING_STATUSES.includes(str(w.status) as WarningStatus) ? str(w.status) : "issued") as WarningStatus;
  const requiresAck = w.requiresAck !== false;
  const staffName = str(w.staffName);
  const issuedAt = str(w.issuedAt);
  const acknowledgedAt = str(w.acknowledgedAt) || null;
  const history: WarningDetail["history"] = [{ id: `${str(w.id)}-issued`, action: "Issued", actor: str(w.issuedBy), at: issuedAt, previous: null, next: "Issued", note: null }];
  if (acknowledgedAt) history.push({ id: `${str(w.id)}-ack`, action: "Acknowledged by staff", actor: staffName, at: acknowledgedAt, previous: "Issued", next: "Acknowledged", note: str(w.staffComment) || null });
  return {
    id: str(w.id), reference: str(w.reference), staff: { id: str(w.staffId), name: staffName }, clientId: str(w.clientId), client: str(w.clientName),
    outletId: str(w.outletId), outlet: str(w.outletName), type: str(w.type), severity: str(w.severity), issuedBy: str(w.issuedBy),
    effectiveDate: str(w.effectiveDate).slice(0, 10), status,
    ack: !requiresAck ? "not-required" : status === "acknowledged" || acknowledgedAt ? "acknowledged" : "awaiting",
    acknowledgedAt, details: str(w.details), issuedAt, requiresAcknowledgement: requiresAck,
    withdrawnReason: status === "withdrawn" ? str(w.withdrawnReason) || null : null, disputeNote: null, history,
    canWithdraw: canIssue && status !== "withdrawn",
  };
}

async function warningsData(force = true): Promise<WarningsData> {
  if (warningsCache && !force) return warningsCache;
  const r = await call("warning-list", {});
  const canIssue = r.canIssue === true;
  const items = arr(r.items).map((x) => warningOf(x, canIssue)).filter((x): x is WarningDetail => !!x);
  for (const raw of arr(r.items)) { const w = rec(raw); if (w) warningRevisions.set(str(w.id), Number(w.revision) || 1); }
  const staff = arr(r.staff).map(rec).filter((p): p is Rec => !!p && !!str(p.id)).map((p) => ({ id: str(p.id), name: str(p.name), client: str(p.client), outlet: str(p.outlet), clientId: str(p.clientId), outletId: str(p.outletId) }));
  warningsCache = { items, canIssue, types: arr(r.types).map(str).filter(Boolean), severities: arr(r.severities).map(str).filter(Boolean), staff };
  return warningsCache;
}

const toWarningRow = (w: WarningDetail): WarningRow => ({
  id: w.id, reference: w.reference, staff: w.staff, clientId: w.clientId, client: w.client, outletId: w.outletId, outlet: w.outlet,
  type: w.type, severity: w.severity, issuedBy: w.issuedBy, effectiveDate: w.effectiveDate, status: w.status, ack: w.ack, acknowledgedAt: w.acknowledgedAt,
});

/** Clients / outlets to filter by: those on a record or among the staff HR may warn (both already scoped by the server). */
function warningFacets(d: WarningsData): ScopeFacets {
  const clients = new Map<string, string>();
  const outlets = new Map<string, { id: string; clientId: string; name: string }>();
  for (const w of d.items) { if (w.clientId) clients.set(w.clientId, w.client); if (w.outletId) outlets.set(w.outletId, { id: w.outletId, clientId: w.clientId, name: w.outlet }); }
  for (const p of d.staff) { if (p.clientId) clients.set(p.clientId, p.client); if (p.outletId) outlets.set(p.outletId, { id: p.outletId, clientId: p.clientId, name: p.outlet }); }
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  return { clients: [...clients].map(([id, name]) => ({ id, name })).sort(byName), outlets: [...outlets.values()].sort(byName) };
}

async function freshWarning(id: string): Promise<WarningDetail> {
  const d = await warningsData(true);
  const w = d.items.find((x) => x.id === id);
  if (!w) throw new Error("Reload to see this record.");
  return w;
}


export const liveWorkforceAdapter: WorkforceAdapter = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async listAttendance(q): Promise<AttendancePage> {
    const [{ facets }, r] = await Promise.all([outlets(), call("attendance", { from: q.from, to: q.to })]);
    const leave = await leaves(true).catch(() => null);
    const all = arr(r.items).map(attendanceRow).filter((x): x is AttendanceRow => !!x)
      .map((row) => (leave && !row.checkIn && onLeave(leave.rows, row.staff.id, row.date) ? { ...row, status: "on-leave" as AttendanceStatus } : row));
    lastRows = all;
    const term = q.search.trim().toLowerCase();
    const scoped = all.filter((row) => (!q.clientId || row.clientId === q.clientId) && (!q.outletId || row.outletId === q.outletId)
      && (!term || [row.staff.name, row.outlet, row.client, row.role].some((v) => v.toLowerCase().includes(term))));
    const inTab = (row: AttendanceRow, tab: AttendanceTab) => tab === "all" || (tab === "corrections" ? false : row.status === tab);
    const tabs: AttendanceTab[] = ["all", "present", "late", "absent", "on-leave", "corrections"];
    const tabCounts = Object.fromEntries(tabs.map((t) => [t, scoped.filter((row) => inTab(row, t)).length])) as Record<AttendanceTab, number>;
    const rows = scoped.filter((row) => inTab(row, q.tab));
    const today = todayISO();
    const t = scoped.filter((row) => row.date === today);
    return {
      rows: rows.slice(0, q.pageSize), total: rows.length, tabCounts, facets, workspaceEmpty: all.length === 0,
      today: { date: today, scheduled: t.length, checkedIn: t.filter((r2) => r2.checkIn).length, notYet: t.filter((r2) => r2.status === "not-yet").length,
        late: t.filter((r2) => r2.status === "late").length, absent: t.filter((r2) => r2.status === "absent").length, onLeave: t.filter((r2) => r2.status === "on-leave").length },
    };
  },
  async getAttendance(id): Promise<AttendanceDetail | null> {
    let row = lastRows.find((r) => r.id === id);
    if (!row) {
      const today = todayISO();
      const r = await call("attendance", { from: addDays(today, -62), to: addDays(today, 0) });
      lastRows = arr(r.items).map(attendanceRow).filter((x): x is AttendanceRow => !!x);
      row = lastRows.find((x) => x.id === id);
    }
    return row ? { ...row, reference: "", note: null, pendingCorrection: null, history: [], canRequestCorrection: false } : null;
  },
  async requestCorrection() { throw new Error(NOT_CONNECTED); },

  async getSchedule(q) {
    const { facets } = await outlets();
    if (facets.outlets.length === 0) return { facets, roster: null, workspaceEmpty: true };
    const outletId = facets.outlets.some((o) => o.id === q.outletId) ? q.outletId : facets.outlets[0].id;
    const weekStart = startOfWeek(q.weekStart || todayISO());
    lastWeek.set(outletId, weekStart);
    return { facets, roster: await roster(outletId, weekStart), workspaceEmpty: false };
  },
  async checkShiftConflicts() { return []; }, // the server lists clashes on every shift after saving
  async saveShift(outletId, shiftId, input) {
    await call("shift-save", { outletId, shiftId, expectedRevision: shiftId ? revisions.get(shiftId) : undefined, staffId: input.staffId, date: input.date,
      start: input.start, end: input.end, breakMins: input.breakMins, role: input.role, section: input.section });
    changed();
    return roster(outletId, startOfWeek(input.date));
  },
  async removeShift(outletId, shiftId) {
    await call("shift-remove", { shiftId, expectedRevision: revisions.get(shiftId) });
    changed();
    return roster(outletId, lastWeek.get(outletId) ?? startOfWeek(todayISO()));
  },
  async publishWeek(outletId, weekStart) {
    await call("week-publish", { outletId, weekStart });
    changed();
    return roster(outletId, weekStart);
  },
  async unpublishWeek() { throw new Error(NOT_CONNECTED); },
  async copyLastWeek(outletId, weekStart) {
    await call("week-copy", { outletId, weekStart });
    changed();
    return roster(outletId, weekStart);
  },

  async listLeave(q): Promise<LeavePage> {
    const [{ facets }, l] = await Promise.all([outlets(), leaves(true)]);
    const term = q.search.trim().toLowerCase();
    const scoped = l.rows.filter((row) => (!q.clientId || row.clientId === q.clientId) && (!q.outletId || row.outletId === q.outletId) && (!q.type || row.type === q.type)
      && (!term || [row.staff.name, row.outlet, row.client, row.type].some((v) => v.toLowerCase().includes(term))));
    const tabs: LeaveTab[] = ["pending", "approved", "declined", "cancelled"];
    const tabCounts = Object.fromEntries(tabs.map((t) => [t, scoped.filter((row) => row.status === t).length])) as Record<LeaveTab, number>;
    const rows = scoped.filter((row) => row.status === q.tab);
    const today = todayISO();
    const whoIsOff = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((date) => ({
      date, people: l.rows.filter((row) => row.status === "approved" && row.startDate <= date && row.endDate >= date).map((row) => row.staff),
    })).filter((d) => d.people.length);
    return { rows: rows.slice(0, q.pageSize), total: rows.length, tabCounts, whoIsOff, facets: { ...facets, types: l.types }, canApprove: l.canApprove, workspaceEmpty: l.rows.length === 0 };
  },
  async listTimeOff(q): Promise<TimeOffResult> {
    const l = await leaves(true);
    const term = q.search.trim().toLowerCase();
    const approved = l.rows.filter((row) => row.status === "approved" && row.endDate >= q.from && row.startDate <= q.to && (!term || row.staff.name.toLowerCase().includes(term)));
    const days: TimeOffResult["days"] = [];
    for (let d = q.from; d <= q.to; d = addDays(d, 1)) {
      const people = approved.filter((row) => row.startDate <= d && row.endDate >= d).map((row) => ({ ...row.staff, type: row.type, requestId: row.id }));
      if (people.length) days.push({ date: d, people });
    }
    return { days, entries: approved.map((row) => ({ id: row.id, staff: row.staff, type: row.type, startDate: row.startDate, endDate: row.endDate, days: row.days, outlet: row.outlet, client: row.client, decidedBy: row.decidedBy, decidedAt: row.decidedAt })), workspaceEmpty: l.rows.length === 0 };
  },
  async getStaffLeaveHistory(staffId): Promise<StaffLeaveHistory | null> {
    const l = await leaves();
    const mine = l.rows.filter((row) => row.staff.id === staffId);
    const year = todayISO().slice(0, 4);
    return { takenThisYear: mine.filter((row) => row.status === "approved" && row.startDate.startsWith(year)).reduce((n, row) => n + row.days, 0), balance: null,
      requests: mine.map((row) => ({ id: row.id, type: row.type, startDate: row.startDate, endDate: row.endDate, days: row.days, status: row.status })) };
  },
  async approveLeave(id) { return decide(id, "approve", ""); },
  async declineLeave(id, input) { return decide(id, "decline", input.reason); },
  async listWarnings(q): Promise<WarningsPage> {
    const d = await warningsData(true);
    const term = q.search.trim().toLowerCase();
    const scoped = d.items.filter((w) => (!q.clientId || w.clientId === q.clientId) && (!q.outletId || w.outletId === q.outletId) && (!q.type || w.type === q.type)
      && (!term || [w.staff.name, w.type, w.severity, w.reference, w.outlet, w.client].some((v) => v.toLowerCase().includes(term))));
    const tabs: WarningTab[] = ["all", "issued", "acknowledged", "disputed", "withdrawn"];
    const tabCounts = Object.fromEntries(tabs.map((t) => [t, scoped.filter((w) => t === "all" || w.status === t).length])) as Record<WarningTab, number>;
    const rows = scoped.filter((w) => q.tab === "all" || w.status === q.tab);
    return {
      rows: rows.slice(0, q.pageSize).map(toWarningRow), total: rows.length, tabCounts,
      facets: { ...warningFacets(d), types: d.types },
      options: { types: d.types, severities: d.severities, staff: d.staff.map((p) => ({ id: p.id, name: p.name, client: p.client, outlet: p.outlet })) },
      canIssue: d.canIssue, workspaceEmpty: d.items.length === 0,
    };
  },
  async getWarning(id) {
    const d = await warningsData(!warningsCache?.items.some((w) => w.id === id));
    return d.items.find((w) => w.id === id) ?? null;
  },
  async issueWarning(input) {
    const r = await call("warning-issue", { staffId: input.staffId, type: input.type, severity: input.severity, details: input.details.trim(), effectiveDate: input.effectiveDate, requiresAck: input.requiresAcknowledgement });
    changed();
    return freshWarning(str(r.id));
  },
  async withdrawWarning(id, input) {
    await call("warning-withdraw", { warningId: id, expectedRevision: warningRevisions.get(id) ?? 1, reason: input.reason.trim() });
    changed();
    return freshWarning(id);
  },
  /** This person's warnings (Admin staff profile, Warnings tab), from the same scoped list. */
  async getStaffWarnings(staffId) {
    return (await warningsData(true)).items.filter((w) => w.staff.id === staffId);
  },
};
