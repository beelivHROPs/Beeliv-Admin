"use client";

/**
 * LIVE Interviews adapter: the approved Interviews screens on REAL interviews (recruitment-interviews-phase2.sql) via
 * POST /api/admin/applications/{interview-list, interview-save, interview-cancel, interview-record}. The server checks
 * the Admin session (AAL2), role and client scope; `canManage` comes from the server, never from a client role check.
 *
 * Ids: an interview is `<applicationId>.<interviewId>`; a shortlisted applicant with no interview yet ("To schedule")
 * is `<applicationId>.new`. Both are internal keys built from server ids, never a BLV-* reference.
 * When the backend is not switched on (`unavailable`) the screens get the approved empty state, never sample data.
 */
import { RestrictedError, type AdapterEvent } from "../adapter";
import { ExplainedError, explainError, networkError } from "../../shared/error-messages";
import type { InterviewsAdapter } from "./adapter";
import type {
  InterviewDetail,
  InterviewHistoryEntry,
  InterviewMethod,
  InterviewOutcome,
  InterviewRecommendation,
  InterviewRow,
  InterviewsPage,
  InterviewsQuery,
  InterviewStatus,
  InterviewTab,
  ScoringCriterion,
} from "./types";

/* ---------- wire DTOs (mirror lib/server/applications/types.ts; copied, never imported from lib/server) ---------- */
type Mode = "in_person" | "phone" | "video";
type Scores = Record<"presentation" | "communication" | "guest_service" | "role_skills" | "teamwork" | "reliability", number>;
type ItemDto = {
  id: string; revision: number; state: "scheduled" | "cancelled" | "completed"; startsAt: string; durationMins: number; mode: Mode; location: string;
  interviewerName: string; scores: Scores | null; recommendation: "strongly_recommend" | "recommend" | "not_recommended" | null; outcome: InterviewOutcome | null;
  note: string | null; updatedAt: string; applicationId: string; applicationRevision: number; applicantName: string;
  vacancyId: string; vacancyTitle: string; clientName: string; outletName: string | null;
};
type ListDto = { canManage: boolean; items: ItemDto[] };
type AppRowDto = { applicationId: string; vacancyId: string; role: string; clientName: string; applicantName: string; lifecycle: string; stage: number; submittedAt: string };
type AppPageDto = { items: AppRowDto[]; total: number };
type HistoryDto = { history: { action: string; at: string; note: string | null; from: string | null; to: string | null; actor: string }[] };

class Unavailable extends Error {}

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/applications/${action}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw networkError();
  }
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: { code?: string; message?: string } } & Record<string, unknown>) | null;
  if (json?.ok === true) {
    const { ok: _ok, ...rest } = json;
    void _ok;
    return rest as T;
  }
  const code = json?.error?.code ?? "unavailable";
  if (code === "forbidden" || code === "unauthenticated") throw new RestrictedError();
  if (code === "unavailable") throw new Unavailable("unavailable");
  // Our own wording (lib/shared/error-messages.ts), never the server's text.
  throw new ExplainedError(code, explainError(code, "interview"));
}

/* ---------- the six live score points (lead decision 2026-11-24) ---------- */
export const LIVE_CRITERIA: ScoringCriterion[] = [
  { id: "presentation", label: "Presentation", hint: "Grooming, uniform-ready, first impression", scale: 5, weight: 1 },
  { id: "communication", label: "Communication", hint: "Clear, polite, easy to follow", scale: 5, weight: 1 },
  { id: "guest_service", label: "Guest service", hint: "Warmth and willingness to help guests", scale: 5, weight: 1 },
  { id: "role_skills", label: "Role skills", hint: "Knows the work of this role", scale: 5, weight: 1 },
  { id: "teamwork", label: "Teamwork", hint: "Examples of working with others", scale: 5, weight: 1 },
  { id: "reliability", label: "Reliability", hint: "Punctual, dependable, follows through", scale: 5, weight: 1 },
];
const LIVE_RECOMMENDATIONS: InterviewRecommendation[] = ["strongly_recommend", "recommend", "not_recommended"];
const STAGE = { id: "interview", name: "Interview" } as const;
const METHOD: Record<Mode, InterviewMethod> = { in_person: "in-person", phone: "phone", video: "video" };
const MODE: Record<InterviewMethod, Mode> = { "in-person": "in_person", phone: "phone", video: "video" };
const HTTPS = /^https:\/\/\S+$/i;

/* ---------- ids and dates ---------- */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseKey(key: string): { applicationId: string; interviewId: string | null } | null {
  const [a, b, extra] = key.split(".");
  if (extra !== undefined || !a || !UUID.test(a) || !b) return null;
  if (b === "new") return { applicationId: a, interviewId: null };
  return UUID.test(b) ? { applicationId: a, interviewId: b } : null;
}
export const interviewKey = (applicationId: string, interviewId: string | null) => `${applicationId}.${interviewId ?? "new"}`;
/** Calendar day in Lagos (the database reads p_from / p_to as Africa/Lagos days). */
const lagosDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/* ---------- mapping ---------- */
const revisions = new Map<string, number>();

function nextOf(r: Pick<InterviewRow, "status" | "at">): { nextAction: string | null; needsAttention: boolean } {
  if (r.status === "to-schedule") return { nextAction: "Schedule interview", needsAttention: true };
  if (r.status === "scheduled" && r.at && new Date(r.at).getTime() < Date.now()) return { nextAction: "Record outcome", needsAttention: true };
  if (r.status === "scheduled") return { nextAction: "Interview upcoming", needsAttention: false };
  return { nextAction: null, needsAttention: false };
}

function toRow(i: ItemDto): InterviewRow {
  const video = i.mode === "video";
  const link = video && HTTPS.test(i.location) ? i.location : null;
  const total = i.scores ? Object.values(i.scores).reduce((a, b) => a + b, 0) : null;
  const row: InterviewRow = {
    id: interviewKey(i.applicationId, i.id),
    applicantId: i.applicationId,
    candidateName: i.applicantName,
    vacancyId: i.vacancyId,
    vacancy: i.vacancyTitle,
    client: i.outletName ? `${i.clientName} (${i.outletName})` : i.clientName,
    stageId: STAGE.id,
    stageName: STAGE.name,
    at: i.startsAt,
    durationMins: i.durationMins,
    interviewer: i.interviewerName ? { id: `name:${i.interviewerName}`, name: i.interviewerName } : null,
    method: METHOD[i.mode],
    location: link ? null : i.location || null,
    link,
    defaults: null,
    status: i.state,
    totalScore: total,
    maxScore: total === null ? null : LIVE_CRITERIA.length * 5,
    recommendation: i.recommendation,
    nextAction: null,
    needsAttention: false,
  };
  revisions.set(row.id, i.revision);
  return { ...row, ...nextOf(row) };
}

function pendingRow(a: { applicationId: string; applicantName: string; vacancyId: string; role: string; clientName: string }): InterviewRow {
  const row: InterviewRow = {
    id: interviewKey(a.applicationId, null), applicantId: a.applicationId, candidateName: a.applicantName, vacancyId: a.vacancyId, vacancy: a.role, client: a.clientName,
    stageId: STAGE.id, stageName: STAGE.name, at: null, durationMins: 45, interviewer: null, method: null, location: null, link: null, defaults: null,
    status: "to-schedule", totalScore: null, maxScore: null, recommendation: null, nextAction: null, needsAttention: false,
  };
  return { ...row, ...nextOf(row) };
}

const HISTORY_LABEL: Record<string, string> = {
  interview_scheduled: "Interview scheduled", interview_rescheduled: "Interview rescheduled", interview_cancelled: "Interview cancelled",
  interview_passed: "Interview passed", interview_not_passed: "Interview not passed",
};

function toDetail(row: InterviewRow, item: ItemDto | null, canManage: boolean, canScheduleNew: boolean, history: InterviewHistoryEntry[]): InterviewDetail {
  const scheduled = row.status === "scheduled";
  return {
    ...row,
    applicantReference: "",
    interviewerOptions: [],
    criteria: LIVE_CRITERIA,
    whoMayScore: [],
    scorecard: {
      ratings: item?.scores ? { ...item.scores } : {},
      notes: item?.note ?? "",
      recommendation: item?.recommendation ?? null,
      submittedAt: row.status === "completed" && item ? item.updatedAt : null,
      submittedBy: null,
    },
    pathway: [],
    history,
    capabilities: { canSchedule: canManage && canScheduleNew, canReschedule: canManage && scheduled, canCancel: canManage && scheduled, canScore: canManage && scheduled },
    liveResult: { recommendations: LIVE_RECOMMENDATIONS, outcome: item?.outcome ?? null, revision: item?.revision ?? 0 },
  };
}

/* ---------- reads ---------- */
async function listWindow(from: Date, to: Date): Promise<ListDto> {
  return call<ListDto>("interview-list", { from: lagosDay(from), to: lagosDay(to) });
}

/** Shortlisted (stage 1) applications in scope: they are the "To schedule" interviews. */
async function shortlisted(): Promise<AppRowDto[]> {
  const rows: AppRowDto[] = [];
  for (let page = 1; page <= 4; page++) {
    const p = await call<AppPageDto>("list", { page, pageSize: 50 });
    rows.push(...p.items);
    if (rows.length >= p.total || p.items.length < 50) break;
  }
  return rows.filter((r) => r.lifecycle === "submitted" && r.stage === 1);
}

function matches(r: InterviewRow, q: InterviewsQuery, tab: InterviewTab | null): boolean {
  const needle = q.search.trim().toLowerCase();
  if (needle && ![r.candidateName, r.vacancy, r.client, r.stageName, r.interviewer?.name ?? ""].some((s) => s.toLowerCase().includes(needle))) return false;
  if (q.stageId && r.stageId !== q.stageId) return false;
  if (q.vacancyId && r.vacancyId !== q.vacancyId) return false;
  if (q.interviewerId && r.interviewer?.id !== q.interviewerId) return false;
  if (q.range && (!r.at || r.status === "cancelled" || r.at < q.range.from || r.at >= q.range.to)) return false;
  if (!tab || tab === "all") return true;
  const past = !!r.at && new Date(r.at).getTime() < Date.now();
  if (tab === "to-schedule") return r.status === "to-schedule";
  if (tab === "upcoming") return r.status === "scheduled" && !past;
  if (tab === "needs-outcome") return r.status === "scheduled" && past;
  return r.status === "completed";
}

const EMPTY_COUNTS: Record<InterviewTab, number> = { all: 0, "to-schedule": 0, upcoming: 0, "needs-outcome": 0, completed: 0 };
const emptyPage = (): InterviewsPage => ({ rows: [], total: 0, tabCounts: { ...EMPTY_COUNTS }, facets: { stages: [{ ...STAGE, appliesNote: null }], vacancies: [], interviewers: [] }, schedulable: [], workspaceEmpty: true, canManage: false });

async function history(applicationId: string): Promise<InterviewHistoryEntry[]> {
  try {
    const h = await call<HistoryDto>("history", { applicationId });
    return h.history
      .filter((e) => HISTORY_LABEL[e.action])
      .map((e, i) => ({ id: `h-${i}`, actor: e.actor, at: e.at, action: HISTORY_LABEL[e.action], from: null, to: null, note: e.note }))
      .reverse();
  } catch {
    return [];
  }
}

const listeners = new Set<(e: AdapterEvent) => void>();
const changed = () => listeners.forEach((l) => l("reset"));

/* ---------- writes ---------- */
function placeOf(input: { method: InterviewMethod; location: string; link: string }): string {
  return input.method === "video" ? input.link.trim() : input.location.trim();
}

/** Lagos is UTC+1 all year: send the instant with an explicit offset (the server refuses a bare local time). */
function withOffset(iso: string): string {
  const d = new Date(iso);
  const lagos = new Date(d.getTime() + 3_600_000).toISOString().slice(0, 19);
  return `${lagos}+01:00`;
}

async function revisionOf(key: string): Promise<number> {
  const known = revisions.get(key);
  if (known) return known;
  const d = await liveInterviewsAdapter.getInterview(key);
  const r = d?.liveResult?.revision;
  if (!r) throw new Error("Reload to see this interview.");
  return r;
}

async function reload(key: string): Promise<InterviewDetail> {
  changed();
  const d = await liveInterviewsAdapter.getInterview(key);
  if (!d) throw new Error("Reload to see this interview.");
  return d;
}

export const liveInterviewsAdapter: InterviewsAdapter = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async listInterviews(q: InterviewsQuery): Promise<InterviewsPage> {
    let replies: ListDto[];
    let pending: AppRowDto[] = [];
    try {
      if (q.range) {
        replies = [await listWindow(new Date(q.range.from), new Date(new Date(q.range.to).getTime() - 1))];
      } else {
        // Six months around today: the database answers at most 92 days per request.
        const now = new Date();
        replies = await Promise.all([listWindow(plusDays(now, -92), now), listWindow(plusDays(now, 1), plusDays(now, 93))]);
        pending = await shortlisted().catch(() => []);
      }
    } catch (e) {
      if (e instanceof Unavailable) return emptyPage();
      throw e;
    }
    const canManage = replies.every((r) => r.canManage);
    const seen = new Set<string>();
    const rows = replies.flatMap((r) => r.items).filter((i) => !seen.has(i.id) && !!seen.add(i.id)).map(toRow);
    const pendingRows = pending.filter((a) => !rows.some((r) => r.applicantId === a.applicationId && r.status === "scheduled")).map(pendingRow);
    const all = [...rows, ...pendingRows];
    const base = all.filter((r) => matches(r, q, null));
    const count = (tab: InterviewTab) => base.filter((r) => matches(r, q, tab)).length;
    const cmpAt = (a: InterviewRow, b: InterviewRow) => (a.at ?? "9999").localeCompare(b.at ?? "9999");
    const tabbed = base
      .filter((r) => matches(r, q, q.tab))
      .sort((a, b) => (q.sort === "latest" ? cmpAt(b, a) : q.sort === "candidate" ? a.candidateName.localeCompare(b.candidateName) : cmpAt(a, b)));
    const uniq = <T extends { id: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.id, x])).values()];
    return {
      rows: tabbed.slice((Math.max(1, q.page) - 1) * q.pageSize, Math.max(1, q.page) * q.pageSize),
      total: tabbed.length,
      tabCounts: { all: count("all"), "to-schedule": count("to-schedule"), upcoming: count("upcoming"), "needs-outcome": count("needs-outcome"), completed: count("completed") },
      facets: {
        stages: [{ ...STAGE, appliesNote: null }],
        vacancies: uniq(all.map((r) => ({ id: r.vacancyId, name: r.vacancy }))),
        interviewers: uniq(all.flatMap((r) => (r.interviewer ? [r.interviewer] : []))),
      },
      schedulable: canManage ? pendingRows.map((r) => ({ id: r.id, label: `${r.candidateName} (${r.vacancy})`, defaults: null })) : [],
      workspaceEmpty: all.length === 0,
      canManage,
    };
  },

  async getInterview(key) {
    const k = parseKey(key);
    if (!k) return null;
    let list: ListDto;
    try {
      list = await call<ListDto>("interview-list", { applicationId: k.applicationId });
    } catch (e) {
      if (e instanceof RestrictedError) throw e;
      if (e instanceof Unavailable) return null;
      throw e;
    }
    const hasScheduled = list.items.some((i) => i.state === "scheduled");
    const hist = await history(k.applicationId);
    if (k.interviewId) {
      const item = list.items.find((i) => i.id === k.interviewId);
      return item ? toDetail(toRow(item), item, list.canManage, false, hist) : null;
    }
    // "To schedule": the application itself (its name, job and client), schedulable while shortlisted with nothing booked.
    let app: AppRowDto & { lifecycle: string; stage: number };
    try {
      app = await call<AppRowDto>("read", { applicationId: k.applicationId });
    } catch (e) {
      if (e instanceof RestrictedError) throw e;
      return null;
    }
    const open = app.lifecycle === "submitted" && (app.stage === 1 || app.stage === 2) && !hasScheduled;
    return toDetail(pendingRow(app), null, list.canManage, open, hist);
  },

  /** Advisory only and not part of the live contract yet: no clash warnings rather than invented ones. */
  async checkConflicts() {
    return [];
  },

  async scheduleInterview(key, input) {
    const k = parseKey(key);
    if (!k) throw new Error("Choose who to schedule.");
    const r = await call<{ interviewId: string; revision: number }>("interview-save", {
      applicationId: k.applicationId, startsAt: withOffset(input.at), durationMins: input.durationMins, mode: MODE[input.method],
      location: placeOf(input), interviewerName: (input.interviewerName ?? "").trim(), ...(input.reason?.trim() ? { note: input.reason.trim() } : {}),
    });
    const next = interviewKey(k.applicationId, r.interviewId);
    revisions.set(next, r.revision);
    return reload(next);
  },

  async rescheduleInterview(key, input) {
    const k = parseKey(key);
    if (!k?.interviewId) throw new Error("Reload to see this interview.");
    const expectedRevision = await revisionOf(key);
    const r = await call<{ revision: number }>("interview-save", {
      applicationId: k.applicationId, interviewId: k.interviewId, expectedRevision, startsAt: withOffset(input.at), durationMins: input.durationMins,
      mode: MODE[input.method], location: placeOf(input), interviewerName: (input.interviewerName ?? "").trim(), ...(input.reason?.trim() ? { note: input.reason.trim() } : {}),
    });
    revisions.set(key, r.revision);
    return reload(key);
  },

  async cancelInterview(key, input) {
    const k = parseKey(key);
    if (!k?.interviewId) throw new Error("Reload to see this interview.");
    const r = await call<{ revision: number }>("interview-cancel", { interviewId: k.interviewId, expectedRevision: await revisionOf(key), note: input.reason.trim() });
    revisions.set(key, r.revision);
    return reload(key);
  },

  async saveScorecard(key, input) {
    const k = parseKey(key);
    if (!k?.interviewId || !input.outcome) throw new Error("Choose Passed or Not passed.");
    const scores = Object.fromEntries(LIVE_CRITERIA.map((c) => [c.id, input.ratings[c.id]]));
    const r = await call<{ revision: number }>("interview-record", {
      interviewId: k.interviewId, expectedRevision: await revisionOf(key), scores, recommendation: input.recommendation, outcome: input.outcome,
      ...(input.notes.trim() ? { note: input.notes.trim() } : {}),
    });
    revisions.set(key, r.revision);
    return reload(key);
  },
};

/** Interviews of ONE application (Applicant 360). Empty when the backend is off. */
export async function listApplicationInterviews(applicationId: string): Promise<{ canManage: boolean; items: { key: string; state: InterviewStatus; at: string; interviewer: string | null; recommendation: InterviewRecommendation | null; outcome: InterviewOutcome | null }[] }> {
  try {
    const l = await call<ListDto>("interview-list", { applicationId });
    return { canManage: l.canManage, items: l.items.map((i) => ({ key: interviewKey(i.applicationId, i.id), state: i.state, at: i.startsAt, interviewer: i.interviewerName || null, recommendation: i.recommendation, outcome: i.outcome })) };
  } catch (e) {
    if (e instanceof RestrictedError || e instanceof Unavailable) return { canManage: false, items: [] };
    throw e;
  }
}
