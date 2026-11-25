/**
 * LIVE Inbox adapter. The only Inbox source with a Beeliv backend today is CLIENT STAFF REQUESTS
 * (POST /api/admin/requests/*, docs/contracts/day2-warnings-requests.sql part B), so a live Inbox lists exactly those,
 * each as a "workforce-request" case. Every other source (enquiries, support, unmatched email...) has no backend yet and is
 * EMPTY here: never sample data. Replies, internal notes, assignment and escalation are not served for requests, so those
 * permissions are off and the calls reject plainly. The status change happens through `updateWorkforceRequest`.
 * Only relative imports so the mapping is unit-tested offline (tests/day2-staff-requests.test.cjs).
 */
import { RestrictedError } from "../adapter";
import { errorFromReply, networkError } from "../../shared/error-messages";
import { NotFoundError, type InboxAdapter } from "./adapter";
import type {
  InboxActivity, InboxCaseDetail, InboxCaseSummary, InboxList, InboxMessage, InboxPermissions, InboxStatus, WorkforceRequestHistoryEntry,
  WorkforceRequestInfo, WorkforceRequestStatus,
} from "./types";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

const STATUSES: readonly WorkforceRequestStatus[] = ["submitted", "under-review", "in-recruitment", "candidates-submitted", "closed"];
/** HR-facing names for a request's status. */
export const REQUEST_STATUS_LABEL: Record<WorkforceRequestStatus, string> = {
  submitted: "Submitted",
  "under-review": "Under review",
  "in-recruitment": "In recruitment",
  "candidates-submitted": "Candidates submitted",
  closed: "Closed",
};
/** The Inbox's own status for the list chip and filter: new until someone picks it up, resolved once closed. */
const INBOX_STATUS: Record<WorkforceRequestStatus, InboxStatus> = {
  submitted: "new", "under-review": "open", "in-recruitment": "open", "candidates-submitted": "open", closed: "resolved",
};
const NO_PERMISSIONS: InboxPermissions = { canAssign: false, canReply: false, canAddNote: false, canChangeStatus: false, canEscalate: false };

const statusOf = (v: unknown): WorkforceRequestStatus | null => STATUSES.find((s) => s === v) ?? null;

function history(raw: unknown): WorkforceRequestHistoryEntry | null {
  const h = rec(raw);
  const action = h ? (["submitted", "status_changed", "message"] as const).find((a) => a === h.action) : undefined;
  if (!h || !action || !str(h.at)) return null;
  return { action, from: statusOf(h.from), to: statusOf(h.to), note: str(h.note) || null, at: str(h.at), by: str(h.by) };
}

/** One server item -> the request facts the drawer shows; null when malformed. */
export function toRequestInfo(raw: unknown, canManage: boolean): WorkforceRequestInfo | null {
  const r = rec(raw);
  const status = r ? statusOf(r.status) : null;
  if (!r || !status || !str(r.id)) return null;
  return {
    requestId: str(r.id), revision: Number.isSafeInteger(r.revision) ? (r.revision as number) : 1, status, requestedBy: str(r.requestedBy),
    clientName: str(r.clientName), outletName: str(r.outletName), role: str(r.role), department: str(r.department), count: Number(r.count) || 0,
    resumptionDate: str(r.resumptionDate), reason: str(r.reason), notes: str(r.notes), message: str(r.message) || null,
    history: arr(r.history).map(history).filter((x): x is WorkforceRequestHistoryEntry => !!x), canManage,
  };
}

/** One server item -> an Inbox case (summary + detail). The case id IS the request id. */
export function toInboxCase(raw: unknown, canManage: boolean): InboxCaseDetail | null {
  const info = toRequestInfo(raw, canManage);
  const r = rec(raw);
  if (!info || !r) return null;
  const submittedAt = str(r.submittedAt), updatedAt = str(r.updatedAt) || submittedAt;
  const subject = `${info.role} x ${info.count}${info.outletName ? ` - ${info.outletName}` : ""}`;
  const asked = `Request for ${info.count} ${info.role} at ${info.outletName || "their outlet"}, starting ${info.resumptionDate}.`;
  // The thread: the client's request, then every message Beeliv sent the client (shown to them in their app, not emailed).
  const messages: InboxMessage[] = [
    { id: `${info.requestId}:request`, direction: "inbound", authorName: info.requestedBy || info.clientName, body: info.notes ? `${asked}\n\n${info.notes}` : asked, createdAt: submittedAt, attachments: [] },
    ...info.history.flatMap((h, i): InboxMessage[] => (h.note ? [{ id: `${info.requestId}:m${i}`, direction: "outbound", authorName: h.by, body: h.note, createdAt: h.at, attachments: [] }] : [])),
  ];
  const activity: InboxActivity[] = info.history.map((h, i) => ({
    id: `${info.requestId}:a${i}`,
    kind: h.action === "submitted" ? "created" : h.action === "message" ? "reply" : "status",
    text: h.action === "submitted" ? "Request submitted" : h.action === "message" ? "Message sent to the client" : `Status changed to ${h.to ? REQUEST_STATUS_LABEL[h.to] : "unknown"}`,
    actorName: h.by,
    createdAt: h.at,
  }));
  const last = messages[messages.length - 1];
  return {
    id: info.requestId,
    reference: str(r.reference),
    subject,
    preview: info.reason || asked,
    category: "workforce-request",
    status: INBOX_STATUS[info.status],
    sender: { name: info.requestedBy || info.clientName, kind: "client", organisation: info.clientName || undefined },
    assignedTo: null,
    lastActivityAt: updatedAt,
    attachmentCount: 0,
    unread: false,
    unreadCount: 0,
    lastFromUs: last.direction === "outbound",
    needsAction: info.status === "submitted",
    createdAt: submittedAt,
    related: null,
    messages,
    notes: [],
    activity,
    replyRoute: { mode: "none", reason: "in-app-only" },
    workforceRequest: info,
  };
}

const REASON: Record<string, string> = {
  stale: "Someone changed this request. It has been reloaded; check it and try again.",
  invalid_transition: "A closed request can't be reopened.",
  invalid_request: "Choose a different status or add a message.",
};

async function call(action: string, body: Rec): Promise<Rec> {
  const res = await fetch(`/api/admin/requests/${action}`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => { throw networkError(); });
  const j = rec(await res.json().catch(() => null));
  if (j?.ok === true) return j;
  const reason = str(j?.reason);
  if (reason === "no_access" || reason === "unauthenticated" || reason === "forbidden" || reason === "mfa_required") throw new RestrictedError();
  // Inbox-specific wording first, then the shared explanation (lib/shared/error-messages.ts).
  throw errorFromReply(j, undefined, { ...REASON, unavailable: "This could not be completed. Please try again." });
}

const listeners = new Set<() => void>();
const changed = () => {
  for (const l of listeners) l();
};
let cache: { at: number; p: Promise<{ cases: InboxCaseDetail[]; canManage: boolean }> } | null = null;
const TTL_MS = 5_000;

function load(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.p;
  const p = call("list", {}).then((j) => {
    const canManage = j.canManage === true;
    const cases = arr(j.items).map((x) => toInboxCase(x, canManage)).filter((x): x is InboxCaseDetail => !!x);
    cases.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return { cases, canManage };
  });
  const entry = { at: Date.now(), p };
  cache = entry;
  p.catch(() => {
    if (cache === entry) cache = null;
  });
  return p;
}

const summary = (d: InboxCaseDetail): InboxCaseSummary => ({
  id: d.id, reference: d.reference, subject: d.subject, preview: d.preview, category: d.category, status: d.status, sender: d.sender,
  assignedTo: d.assignedTo, lastActivityAt: d.lastActivityAt, attachmentCount: d.attachmentCount, unread: d.unread, unreadCount: d.unreadCount,
  lastFromUs: d.lastFromUs, needsAction: d.needsAction,
});
const NOT_SERVED = "This isn't available for staff requests.";
const notServed = async (): Promise<never> => {
  throw new Error(NOT_SERVED);
};

export const liveInboxAdapter: InboxAdapter = {
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async getList(): Promise<InboxList> {
    const { cases } = await load();
    return { role: "hrManager", me: { id: "", name: "" }, permissions: NO_PERMISSIONS, assignees: [], cases: cases.map(summary) };
  },
  async getCase(id) {
    const { cases } = await load();
    const detail = cases.find((c) => c.id === id);
    if (!detail) throw new NotFoundError();
    return { permissions: NO_PERMISSIONS, assignees: [], detail };
  },
  reply: notServed,
  addNote: notServed,
  assign: notServed,
  setStatus: notServed,
  escalate: notServed,
  markRead: async () => undefined,
  retryDelivery: notServed,
  checkDelivery: notServed,
  // No unmatched-email backend yet: empty, never sample.
  listNeedsHome: async () => [],
  searchCasesForPicker: async () => [],
  assignNeedsHome: notServed,
  dismissNeedsHome: notServed,
  async updateWorkforceRequest(caseId, status, message) {
    const { cases } = await load();
    const info = cases.find((c) => c.id === caseId)?.workforceRequest;
    if (!info) throw new NotFoundError();
    try {
      await call("update", { requestId: info.requestId, expectedRevision: info.revision, status, message: message.trim() || null });
    } finally {
      // Success or refusal (e.g. stale): reload so the drawer shows what the server now holds.
      cache = null;
      changed();
    }
  },
};

/** Tests only. */
export function resetLiveInbox() {
  cache = null;
}
