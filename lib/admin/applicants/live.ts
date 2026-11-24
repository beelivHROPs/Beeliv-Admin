"use client";

/**
 * LIVE Applicants adapter: the approved HR Applicants screens on REAL submitted applications
 * (POST /api/admin/applications/{list,read}, lib/server/applications). The server checks the Admin session (AAL2),
 * role and client scope; nothing here is authority. No sample people, notes, interviews or recruiters are invented:
 * what the backend does not hold yet is empty, and recruitment actions stay hidden (capabilities false) until their
 * backend exists.
 */
import { RestrictedError, type AdapterEvent } from "../adapter";
import { listApplicationInterviews } from "../interviews/live";
import { RECOMMENDATION_LABEL, OUTCOME_LABEL } from "../interviews/types";
import { getAdminIdentity } from "../ops/identity";
import type { ApplicantsAdapter } from "./adapter";
import type {
  ActivityRecord,
  ApplicantDetail,
  ApplicantDocument,
  ApplicantRow,
  ApplicantsPage,
  ApplicantsQuery,
  ApplicantStatus,
  DocState,
  StageTab,
  SubmissionField,
  SubmissionSection,
} from "./types";

/* ---------- wire DTOs (mirror lib/server/applications/types.ts; copied, never imported from lib/server) ---------- */
type Lifecycle = "submitted" | "in_talent_pool" | "not_selected" | "withdrawn" | "completed";
type Form = {
  fullName?: string; preferredName?: string; phone?: string; whatsapp?: string; email?: string; yearsExperience?: string;
  expectedSalary?: string; availability?: string; earliestStart?: string; preferredLocation?: string;
  willingShifts?: "Yes" | "No"; willingWeekends?: "Yes" | "No"; willingHolidays?: "Yes" | "No";
  sectors?: string[]; skills?: Record<string, string[]>; screeningAnswers?: Record<string, string>;
};
type RowDto = {
  applicationId: string; vacancyId: string; vacancyReference: string; role: string; clientId: string; clientName: string;
  outletId: string | null; applicantName: string; lifecycle: Lifecycle; stage: number; submittedAt: string;
};
type DetailDto = RowDto & {
  form: Form;
  attachments: { slot: "cv" | "passport-photo" | "valid-id"; versionNumber: number; scanState: string; reviewState: string }[];
  events: { action: "draft_opened" | "submitted"; at: string }[];
};
type PageDto = { items: RowDto[]; total: number; page: number; pageSize: number };
type HistoryDto = {
  revision: number; onHold: boolean; lifecycle: Lifecycle; stage: number;
  capabilities: { shortlist: boolean; hold: boolean; resume: boolean; reject: boolean; talentPool: boolean; note: boolean };
  history: { action: string; at: string; note: string | null; from: string | null; to: string | null; actor: string }[];
};

async function call<T>(action: "list" | "read" | "act" | "history" | "verify" | "decide", body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/admin/applications/${action}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: { code?: string } } & Record<string, unknown>) | null;
  if (json?.ok === true) {
    const { ok: _ok, ...rest } = json;
    void _ok;
    return rest as T;
  }
  const code = json?.error?.code;
  if (code === "forbidden" || code === "unauthenticated") throw new RestrictedError();
  const message = (json?.error as { message?: unknown } | undefined)?.message;
  throw Object.assign(new Error(typeof message === "string" ? message : "This could not be saved. Please try again."), { code: code ?? "unavailable" });
}

/* ---------- mapping ---------- */
const STATUS: Record<Lifecycle, ApplicantStatus> = { submitted: "active", completed: "active", in_talent_pool: "talent-pool", not_selected: "rejected", withdrawn: "rejected" };
const PROFILE_KEYS: (keyof Form)[] = ["fullName", "phone", "email", "yearsExperience", "availability", "earliestStart", "preferredLocation", "expectedSalary"];

function profilePercent(f: Form | null): number {
  if (!f) return 100; // list rows: the server accepted a complete submission
  const filled = PROFILE_KEYS.filter((k) => typeof f[k] === "string" && (f[k] as string).trim()).length + (f.sectors?.length ? 1 : 0) + (f.skills && Object.values(f.skills).some((v) => v.length) ? 1 : 0);
  return Math.round((filled / (PROFILE_KEYS.length + 2)) * 100);
}

/**
 * Database stage (recruitment phases 1-3: 0 application, 1 shortlisted, 2 interview, 3 documentation, 4 verified / awaiting
 * Head of Operations approval, 5 approved with lifecycle "completed") -> the screens' stage index (APPLICATION_STAGES).
 * Awaiting approval shows as "Approval"; approved (a staff record exists) shows as "Onboarding" (hired).
 */
export function shownStage(stage: number, lifecycle: Lifecycle): number {
  if (lifecycle === "completed" || stage >= 5) return 6;
  if (stage === 4) return 5;
  return Math.max(0, stage);
}
const NEXT_LABEL: Record<number, string> = { 0: "Review application", 1: "Schedule interview", 2: "Record interview result", 3: "Verify documents", 4: "Awaiting approval" };

function toRow(d: RowDto, form: Form | null = null): ApplicantRow {
  const fresh = d.lifecycle === "submitted" && d.stage === 0;
  const open = d.lifecycle === "submitted";
  return {
    id: d.applicationId,
    reference: "",
    applicationRef: d.vacancyReference,
    name: d.applicantName,
    vacancyId: d.vacancyId,
    vacancy: d.role,
    clientId: d.clientId,
    client: d.clientName,
    outlet: "",
    appliedAt: d.submittedAt,
    updatedAt: d.submittedAt,
    stage: shownStage(d.stage, d.lifecycle),
    status: STATUS[d.lifecycle] ?? "active",
    shortlisted: open && d.stage === 1,
    recruiter: null,
    profilePercent: profilePercent(form),
    // Submit is refused unless the CV, passport photo and valid ID are all scan-clean, so a submitted application has them.
    documentsPercent: 100,
    nextAction: open ? NEXT_LABEL[d.stage] ?? null : null,
    needsAttention: fresh,
    inTalentPool: d.lifecycle === "in_talent_pool",
  };
}

const SLOT_LABEL = { cv: "CV", "passport-photo": "Passport photograph", "valid-id": "Valid ID" } as const;
function docState(scan: string, review: string): DocState {
  if (review === "verified") return "verified";
  if (review === "rejected" || scan === "rejected") return "rejected";
  if (review === "resubmission_required") return "missing";
  if (scan === "clean") return "needs-review";
  return "uploaded";
}

function field(id: string, label: string, value: string | undefined | null, items?: string[]): SubmissionField {
  return { id, label, value: value && value.trim() ? value : items?.length ? null : null, ...(items?.length ? { items } : {}) };
}

const ACTION_LABEL: Record<string, string> = {
  draft_opened: "Application started", submitted: "Application submitted", shortlisted: "Shortlisted", held: "Put on hold",
  resumed: "Taken off hold", rejected: "Rejected", talent_pool: "Moved to Talent Pool", note: "Note added",
  interview_scheduled: "Interview scheduled", interview_rescheduled: "Interview rescheduled", interview_cancelled: "Interview cancelled",
  interview_passed: "Interview passed", interview_not_passed: "Interview not passed", documents_verified: "Documents verified",
  approved: "Approved by the Head of Operations", approval_declined: "Declined by the Head of Operations",
};
/** Database stage names (see shownStage). */
const STAGE_NAMES = ["Application", "Review / shortlisting", "Interview / assessment", "Documentation", "Awaiting approval", "Approved"];
/** "submitted:hold:1" -> "Review / shortlisting (on hold)"; lifecycle words for the end states. */
function stateLabel(v: string | null): string | null {
  if (!v) return null;
  const [life, a, b] = v.split(":");
  const hold = a === "hold";
  const stage = Number(hold ? b : a);
  if (life === "not_selected") return "Not selected";
  if (life === "in_talent_pool") return "Talent Pool";
  if (life === "completed") return "Approved";
  return `${STAGE_NAMES[stage] ?? "Application"}${hold ? " (on hold)" : ""}`;
}
const revisions = new Map<string, number>();
/** Staff record made by an approval in this tab (the read model does not carry it; shown right after approving). */
const approvals = new Map<string, { id: string; reference: string }>();
type Interviews = Awaited<ReturnType<typeof listApplicationInterviews>>;
const NO_INTERVIEWS: Interviews = { canManage: false, items: [] };
const IV_TITLE: Record<string, string> = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };

function nextRequiredOf(stage: number, lifecycle: Lifecycle, onHold: boolean, inPool: boolean, ops: boolean): ApplicantDetail["nextRequired"] {
  if (onHold) return { title: "On hold", detail: "This application is paused. Check the history for the reason.", owner: "hr" };
  if (lifecycle === "not_selected" || lifecycle === "withdrawn") return { title: "Not selected", detail: "No further action is needed. The record is kept for history.", owner: "none" };
  if (inPool) return { title: "In the Talent Pool", detail: "They can be matched to future roles.", owner: "none" };
  if (lifecycle === "completed") return { title: "Approved", detail: "A staff record was created. Invite them to the Staff app from their staff record.", owner: "hr" };
  if (stage === 4) return ops ? { title: "Approve or decline", detail: "Documents are verified. Your decision creates the staff record, or closes the application.", owner: "you" } : { title: "Awaiting Head of Operations approval", detail: "Documents are verified. The Head of Operations approves or declines.", owner: "operations" };
  if (stage === 3) return { title: "Check the documents", detail: "Interview passed. Check the documents, then mark them verified.", owner: "hr" };
  if (stage === 2) return { title: "Interview", detail: "The interview is booked. Record the result after it takes place.", owner: "hr" };
  if (stage === 1) return { title: "Schedule the interview", detail: "Shortlisted. Book an interview time.", owner: "hr" };
  return { title: "Review this application", detail: "Check the answers and documents, then shortlist, hold or reject.", owner: "hr" };
}

function toDetail(d: DetailDto, h: HistoryDto | null = null, iv: Interviews = NO_INTERVIEWS): ApplicantDetail {
  const f = d.form ?? {};
  const skills = Object.values(f.skills ?? {}).flat();
  const documents: ApplicantDocument[] = d.attachments.map((a) => ({
    id: `${a.slot}-${a.versionNumber}`,
    type: SLOT_LABEL[a.slot],
    state: docState(a.scanState, a.reviewState),
    uploadedAt: null,
    reviewer: null,
    group: a.slot === "cv" ? "cv" : "checklist",
  }));
  const sections: SubmissionSection[] = [
    { id: "personal", kind: "personal", title: "Personal details", lastEditedAt: null, fields: [field("fullName", "Full name", f.fullName), field("preferredName", "Preferred name", f.preferredName), field("phone", "Phone", f.phone), field("whatsapp", "WhatsApp", f.whatsapp), field("email", "Email", f.email)] },
    { id: "experience", kind: "experience", title: "Experience", lastEditedAt: null, fields: [field("yearsExperience", "Years of experience", f.yearsExperience), field("sectors", "Sectors", null, f.sectors ?? [])] },
    { id: "skills", kind: "skills", title: "Skills", lastEditedAt: null, fields: Object.entries(f.skills ?? {}).filter(([, v]) => v.length).map(([k, v]) => field(`skills-${k}`, k, null, v)) },
    {
      id: "availability", kind: "availability", title: "Availability", lastEditedAt: null,
      fields: [field("availability", "Availability", f.availability), field("earliestStart", "Earliest start", f.earliestStart), field("preferredLocation", "Preferred location", f.preferredLocation), field("expectedSalary", "Expected salary", f.expectedSalary), field("willingShifts", "Willing to work shifts", f.willingShifts), field("willingWeekends", "Willing to work weekends", f.willingWeekends), field("willingHolidays", "Willing to work public holidays", f.willingHolidays)],
    },
    { id: "documents", kind: "documents", title: "Documents", lastEditedAt: null, fields: documents.map((doc) => field(doc.id, doc.type, doc.state === "needs-review" ? "Virus-checked, waiting for HR review" : doc.state === "verified" ? "Verified" : doc.state === "rejected" ? "Rejected" : "Checking")) },
  ];
  const activity: ActivityRecord[] = h
    ? h.history.filter((e) => e.action !== "note").map((e, i) => ({ id: `h-${i}`, actor: e.action === "submitted" || e.action === "draft_opened" ? d.applicantName : e.actor, at: e.at, action: ACTION_LABEL[e.action] ?? e.action, from: stateLabel(e.from), to: stateLabel(e.to) }))
    : d.events.map((e, i) => ({ id: `ev-${i}`, actor: d.applicantName, at: e.at, action: e.action === "submitted" ? "Application submitted" : "Application started", from: null, to: null }));
  const notes = h ? h.history.filter((e) => e.action === "note" && e.note).map((e, i) => ({ id: `n-${i}`, author: e.actor, at: e.at, body: e.note as string })) : [];
  const c = h?.capabilities;
  if (h) revisions.set(d.applicationId, h.revision);
  const lifecycle = h?.lifecycle ?? d.lifecycle;
  const stage = h?.stage ?? d.stage;
  const onHold = !!h?.onHold;
  const open = lifecycle === "submitted" && !onHold;
  const row = toRow({ ...d, lifecycle, stage }, f);
  const booked = iv.items.find((i) => i.state === "scheduled") ?? null;
  const latest = [...iv.items].sort((x, y) => y.at.localeCompare(x.at))[0] ?? null;
  // Approve / Decline: the existing Operations identity (server-verified session, display only); the database refuses anyone but the Head of Operations.
  const ops = getAdminIdentity() === "ops";
  const interviews = iv.items.map((i) => ({
    id: i.key,
    kind: "interview" as const,
    title: "Interview",
    at: i.at,
    interviewer: i.interviewer,
    state: i.state === "to-schedule" ? ("not-scheduled" as const) : i.state,
    recommendation: i.recommendation || i.outcome ? [i.recommendation ? RECOMMENDATION_LABEL[i.recommendation] : null, i.outcome ? OUTCOME_LABEL[i.outcome] : null].filter(Boolean).join(" · ") : null,
    href: `/admin/recruitment/interviews/${i.key}`,
  }));
  return {
    ...row,
    status: h?.onHold ? "hold" : row.status,
    nextAction: h?.onHold ? null : row.nextAction,
    email: f.email ?? "",
    phone: f.phone ?? "",
    location: f.preferredLocation ?? "",
    professionalSummary: "",
    experience: [],
    skills,
    availability: f.availability ?? "",
    preferredLocations: f.preferredLocation ? [f.preferredLocation] : [],
    expectedSalary: f.expectedSalary ? { allowed: true, value: f.expectedSalary } : { allowed: true, value: "" },
    sensitive: [],
    employmentType: "",
    interviewState: booked ? "Scheduled" : latest ? IV_TITLE[latest.state] ?? "Not scheduled" : "Not scheduled",
    assessmentState: "",
    nextRequired: nextRequiredOf(stage, lifecycle, onHold, row.inTalentPool, ops),
    capabilities: {
      canShortlist: !!c?.shortlist, canHold: !!c?.hold, canReject: !!c?.reject || (open && stage === 4 && ops), canRequestInfo: false, canSubmitForApproval: false,
      canApproveSelection: open && stage === 4 && ops, canAddNote: !!c?.note, canMoveToTalentPool: !!c?.talentPool,
      // The server's canManage (application.manage in this client's scope) decides; the database re-checks every write.
      canScheduleInterview: !!h && open && stage === 1 && !booked && iv.canManage,
      canVerifyDocuments: !!h && open && stage === 3 && iv.canManage,
    },
    staffRecord: approvals.get(d.applicationId) ?? null,
    documents,
    screening: [],
    submission: { submittedAt: d.submittedAt, sections: sections.filter((s) => s.fields.length) },
    interviews,
    notes,
    activity,
  };
}

/* ---------- list: fetch the scoped set (bounded), then search/filter/sort/grow on the client ---------- */
async function fetchAll(vacancyId: string): Promise<RowDto[]> {
  const rows: RowDto[] = [];
  for (let page = 1; page <= 4; page++) {
    const p = await call<PageDto>("list", { page, pageSize: 50, ...(vacancyId ? { vacancyId } : {}) });
    rows.push(...p.items);
    if (rows.length >= p.total || p.items.length < 50) break;
  }
  return rows;
}

function inTab(r: ApplicantRow, tab: StageTab): boolean {
  if (tab === "all") return true;
  if (tab === "talent-pool") return r.inTalentPool;
  if (tab === "new") return r.status === "active" && r.stage === 0;
  if (r.status !== "active" || r.inTalentPool) return false;
  // Screen stage index (see shownStage): 1 shortlisted, 2 interview, 3 documentation, 5 awaiting approval. Approved (6) is in All.
  if (tab === "shortlisted") return r.stage === 1;
  if (tab === "interview") return r.stage === 2;
  if (tab === "documentation") return r.stage === 3;
  if (tab === "approval") return r.stage === 5;
  return false;
}

const listeners = new Set<(e: AdapterEvent) => void>();

async function act(id: string, action: string, note?: string) {
  // Started from the list (record not opened yet): read its current revision first.
  const expectedRevision = revisions.get(id) ?? (await call<HistoryDto>("history", { applicationId: id })).revision;
  const r = await call<{ revision: number }>("act", { applicationId: id, expectedRevision, action, ...(note && note.trim() ? { note: note.trim() } : {}) });
  revisions.set(id, r.revision);
  for (const l of listeners) l("reset"); // lists and counts reload
}

export const liveApplicantsAdapter: ApplicantsAdapter = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async listApplicants(q: ApplicantsQuery): Promise<ApplicantsPage> {
    // Applications not switched on yet (Bright's final round): an honest empty list, not an error.
    const rows = await fetchAll(q.vacancyId).catch((e: unknown) => {
      if (e instanceof Error && (e as Error & { code?: string }).code === "unavailable") return [] as RowDto[];
      throw e;
    });
    const all = rows.map((d) => toRow(d));
    const term = q.search.trim().toLowerCase();
    const matched = all.filter(
      (r) =>
        (!term || [r.name, r.vacancy, r.client, r.applicationRef].some((v) => v.toLowerCase().includes(term))) &&
        (!q.clientId || r.clientId === q.clientId) &&
        (!q.stage || (q.stage === "rejected" ? r.status === "rejected" : q.stage === "hold" ? r.status === "hold" : String(r.stage) === q.stage)),
    );
    const tabs: StageTab[] = ["all", "new", "shortlisted", "interview", "documentation", "approval", "talent-pool"];
    const tabCounts = Object.fromEntries(tabs.map((t) => [t, matched.filter((r) => inTab(r, t)).length])) as Record<StageTab, number>;
    const sorted = matched.filter((r) => inTab(r, q.tab)).sort((a, b) =>
      q.sort === "oldest" ? a.appliedAt.localeCompare(b.appliedAt) : q.sort === "name" ? a.name.localeCompare(b.name) : q.sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : b.appliedAt.localeCompare(a.appliedAt),
    );
    const uniq = <T extends { id: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.id, x])).values()];
    return {
      rows: sorted.slice(0, Math.max(1, q.page) * q.pageSize),
      tabCounts,
      total: sorted.length,
      workspaceEmpty: all.length === 0,
      facets: {
        vacancies: uniq(all.map((r) => ({ id: r.vacancyId, name: r.vacancy }))),
        clients: uniq(all.map((r) => ({ id: r.clientId, name: r.client }))),
        recruiters: [],
      },
    };
  },
  async getApplicant(id: string): Promise<ApplicantDetail | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
      // History/capabilities are optional: before the phase 1 database change they are simply not there (read-only view).
      const [d, h, iv] = await Promise.all([
        call<DetailDto>("read", { applicationId: id }),
        call<HistoryDto>("history", { applicationId: id }).catch(() => null),
        listApplicationInterviews(id).catch(() => NO_INTERVIEWS),
      ]);
      return toDetail(d, h, iv);
    } catch (e) {
      if (e instanceof RestrictedError) throw e;
      if (e instanceof Error && (e.message === "invalid_request" || e.message === "not_found")) return null;
      throw e;
    }
  },
  async performAction(id, input) {
    if (input.action === "verify-documents" || input.action === "approve-selection" || (input.action === "reject" && getAdminIdentity() === "ops")) {
      // Current revision and stage straight from the server (never a cached guess for a stage-changing step).
      const before = await call<HistoryDto>("history", { applicationId: id });
      const expectedRevision = before.revision;
      const atApproval = before.lifecycle === "submitted" && before.stage === 4;
      if (input.action === "verify-documents") {
        const r = await call<{ revision: number }>("verify", { applicationId: id, expectedRevision, ...(input.note?.trim() ? { note: input.note.trim() } : {}) });
        revisions.set(id, r.revision);
      } else if (input.action === "approve-selection" || atApproval) {
        const decision = input.action === "approve-selection" ? "approve" : "decline";
        const r = await call<{ revision: number; staffId: string | null; reference: string | null }>("decide", { applicationId: id, expectedRevision, decision, ...(input.note?.trim() ? { note: input.note.trim() } : {}) });
        revisions.set(id, r.revision);
        if (r.staffId && r.reference) approvals.set(id, { id: r.staffId, reference: r.reference });
      } else {
        await act(id, "reject", input.note);
      }
      for (const l of listeners) l("reset");
      const next = await liveApplicantsAdapter.getApplicant(id);
      if (!next) throw new Error("Reload to see this application.");
      return next;
    }
    const action = input.action === "talent-pool" ? "talent_pool" : input.action;
    if (!["shortlist", "hold", "reject", "talent_pool"].includes(action)) throw new Error("This step is not connected yet.");
    await act(id, action, input.note);
    const next = await liveApplicantsAdapter.getApplicant(id);
    if (!next) throw new Error("Reload to see this application.");
    return next;
  },
  async addNote(id, body) {
    await act(id, "note", body);
    const next = await liveApplicantsAdapter.getApplicant(id);
    if (!next) throw new Error("Reload to see this application.");
    return next;
  },
};
