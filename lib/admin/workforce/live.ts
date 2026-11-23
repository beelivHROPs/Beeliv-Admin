/**
 * LIVE workforce adapter: the approved Scheduling and Attendance screens on REAL rosters and check-ins
 * (/api/admin/workforce/*, docs/contracts/workforce-shifts-attendance.sql). Leave, warnings, attendance corrections and
 * unpublish are not connected yet: those calls reject plainly and their pages stay "Coming soon".
 */
import type { AdapterEvent } from "../adapter";
import { RestrictedError } from "../adapter";
import type { WorkforceAdapter } from "./adapter";
import type {
  AttendanceDetail, AttendancePage, AttendanceRow, AttendanceStatus, AttendanceTab, ScopeFacets, ShiftConflict, ShiftRow, ShiftState, WeekRoster,
} from "./types";
import { addDays, startOfWeek, todayISO } from "@/lib/client/format";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const NOT_CONNECTED = "This isn't connected yet.";
const REASON: Record<string, string> = {
  stale: "Someone changed this roster. Reload and try again.",
  not_placed: "This person is not placed at this outlet.",
  already_worked: "This shift has already been worked, so it can't be removed.",
  invalid_request: "Check the shift details and try again.",
};

async function call(action: string, body: Rec): Promise<Rec> {
  const res = await fetch(`/api/admin/workforce/${action}`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = rec(await res.json().catch(() => null));
  if (j?.ok === true) return j;
  const reason = str(j?.reason);
  if (reason === "no_access" || reason === "unauthenticated" || reason === "forbidden" || reason === "mfa_required") throw new RestrictedError();
  throw new Error(REASON[reason] ?? "This could not be completed. Please try again.");
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
    staff, history: [], sections: uniq([...staff.map((s) => s.section), ...shifts.map((s) => s.section)]), roles: uniq([...staff.map((s) => s.role), ...shifts.map((s) => s.role)]),
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

export const liveWorkforceAdapter: WorkforceAdapter = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async listAttendance(q): Promise<AttendancePage> {
    const [{ facets }, r] = await Promise.all([outlets(), call("attendance", { from: q.from, to: q.to })]);
    const all = arr(r.items).map(attendanceRow).filter((x): x is AttendanceRow => !!x);
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
        late: t.filter((r2) => r2.status === "late").length, absent: t.filter((r2) => r2.status === "absent").length, onLeave: 0 },
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

  async listLeave() { throw new Error(NOT_CONNECTED); },
  async listTimeOff() { throw new Error(NOT_CONNECTED); },
  async getStaffLeaveHistory() { throw new Error(NOT_CONNECTED); },
  async approveLeave() { throw new Error(NOT_CONNECTED); },
  async declineLeave() { throw new Error(NOT_CONNECTED); },
  async listWarnings() { throw new Error(NOT_CONNECTED); },
  async getWarning() { throw new Error(NOT_CONNECTED); },
  async issueWarning() { throw new Error(NOT_CONNECTED); },
  async withdrawWarning() { throw new Error(NOT_CONNECTED); },
};
