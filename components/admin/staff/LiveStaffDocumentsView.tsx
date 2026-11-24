"use client";

/**
 * LIVE Staff documents (HR). Same approved layout as the preview Documents page (PageHeading, ListCard, ListToolbar
 * pills + search, avatar rows with status chips). "Review" opens the approved right-hand drawer (Inbox / Invitation
 * details pattern) where the file is shown INSIDE the dashboard and the decision is made with our own dropdowns.
 * Lead 2026-11-24: no browser selects, no opening files in another tab.
 * Security is unchanged from the first live version: the short-lived signed URL is checked (origin, bucket path, token
 * only, expiry within ~2 minutes) before it is ever used, and is never stored or logged.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Files, Search, X } from "@/components/applicant/icons";
import { EmptyState, PageHeading } from "@/components/applicant/primitives";
import { SelectMenu } from "@/components/applicant/SelectMenu";
import { StatusChip } from "@/components/client/StatusChip";
import { AdminAvatar } from "@/components/admin/AdminAvatar";
import { ListCard, ListToolbar } from "@/components/admin/listKit";
import { rowOpenClick, rowOpenKey } from "@/components/admin/RowClick";

/* Lead 2026-11-24: a row with a document opens the drawer on click / Enter / Space (no separate "View" button).
   "Review" stays as the call to action when a decision is due. Rows without an openable file stay plain. */
const OPEN_ROW = "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--ap-violet)";
const openRow = (canOpen: boolean, open: () => void) => (canOpen ? { tabIndex: 0, onClick: rowOpenClick(open), onKeyDown: rowOpenKey(open) } : {});
import type { Decision, HrQueueDto, HrQueueRowDto, OpenGrant, ReasonCode, SlotState } from "@/lib/server/staff-documentation/types";

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/admin/staff-documentation/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(30000),
  });
  const reply = await response.json();
  if (!response.ok || reply?.ok !== true || !reply.value) throw new Error("unavailable");
  return reply.value as T;
}

const STATE: Record<SlotState, { label: string; tone: "ok" | "warn" | "bad" | "info" | "mute" }> = {
  requested: { label: "Awaiting upload", tone: "mute" },
  checking: { label: "Checking file", tone: "info" },
  available: { label: "Needs review", tone: "warn" },
  verified: { label: "Verified", tone: "ok" },
  "update-required": { label: "Update requested", tone: "warn" },
  rejected: { label: "File refused", tone: "bad" },
  expired: { label: "Expired", tone: "mute" },
};
type Tab = "all" | SlotState;
const TABS: Tab[] = ["all", "available", "requested", "checking", "update-required", "verified", "rejected", "expired"];
const DECISIONS: { value: Decision; label: string }[] = [
  { value: "verified", label: "Verify document" },
  { value: "update_required", label: "Request an update" },
  { value: "rejected", label: "Reject document" },
];
const REASONS: { value: ReasonCode; label: string }[] = [
  { value: "unreadable", label: "Cannot read the document" }, { value: "wrong_document", label: "Wrong document" },
  { value: "expired", label: "Expired document" }, { value: "incomplete", label: "Incomplete document" },
  { value: "mismatch", label: "Details do not match" }, { value: "other", label: "Other" },
];
const PAGE = 20;

export function LiveStaffDocumentsView() {
  const [data, setData] = useState<HrQueueDto | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("all");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HrQueueRowDto | null>(null);
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  const load = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true); setError("");
    try {
      const next = await call<HrQueueDto>("hr-queue", { page, pageSize: PAGE, state: tab === "all" ? "" : tab, search });
      if (!Array.isArray(next.items) || !Number.isSafeInteger(next.total)) throw new Error("invalid_reply");
      if (mounted.current && sequence.current === version) setData(next);
    } catch {
      if (mounted.current && sequence.current === version) setError("We couldn't load staff documents. Check your connection, then try again.");
    } finally { if (mounted.current && sequence.current === version) setLoading(false); }
  }, [page, tab, search]);
  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  const onSearch = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setSearch(v.trim()); setPage(1); }, 300);
  };
  const clear = () => { setText(""); setSearch(""); setTab("all"); setPage(1); };
  const rows = data?.items ?? [];
  const filtered = tab !== "all" || !!search;

  return (
    <div>
      <PageHeading title="Documents" />
      {notice ? <p role="status" className="mb-3 rounded-xl bg-(--ap-tint-soft) p-3 text-sm">{notice}</p> : null}
      {!data && loading ? (
        <div className="ap-shimmer h-[320px] rounded-2xl" role="status" aria-busy="true" aria-label="Loading documents" />
      ) : !data && error ? (
        <div className="ap-card rounded-[20px] p-6 min-[768px]:p-8">
          <EmptyState icon={Files} title="We couldn't load staff documents" description={error}
            action={<button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={() => void load()}>Try again</button>} />
        </div>
      ) : data && data.total === 0 && !filtered ? (
        <div className="ap-card rounded-[20px] p-6 min-[768px]:p-8">
          <EmptyState icon={Files} title="No staff documents yet" description="Documents appear here once staff upload them from the Staff app." />
        </div>
      ) : (
        <ListCard title="Staff documents" summary={`${data?.total ?? 0} ${data?.total === 1 ? "document" : "documents"}${filtered ? " match your filters" : ""}`}>
          <ListToolbar
            tabsLabel="Filter documents by status"
            tabs={TABS.map((k) => ({ key: k, label: k === "all" ? "All" : STATE[k].label }))}
            tab={tab}
            onTab={(k) => { setTab(k); setPage(1); }}
            search={{ value: text, onChange: onSearch, label: "Search staff documents", placeholder: "Search staff, reference or document" }}
            sort={null}
          />
          <div className={`@container transition-opacity ${loading ? "opacity-60" : ""}`}>
            {error ? <p role="alert" className="py-3 text-sm text-(--ap-rose)">{error}</p> : null}
            {rows.length === 0 ? (
              <div className="py-6">
                <EmptyState icon={Search} title="No documents match" description="Try a different name, document or status."
                  action={<button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={clear}><X className="size-4" aria-hidden="true" /> Clear search and filters</button>} />
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {rows.map((row) => (
                  <li key={`${row.personId}:${row.slot}`} {...openRow(!!row.current && (row.canOpen || row.canDecide), () => { setNotice(""); setSelected(row); })} className={`${row.current && (row.canOpen || row.canDecide) ? OPEN_ROW : ""} flex min-h-[68px] flex-col gap-2 border-t border-(--ap-line-2) px-2 py-3 first:border-t-0 hover:bg-(--ap-tint-soft) @min-[760px]:flex-row @min-[760px]:items-center @min-[760px]:gap-5`}>
                    <div className="flex min-w-0 items-center gap-3 @min-[760px]:w-[34%]">
                      <AdminAvatar name={row.name} size={40} />
                      <div className="min-w-0 leading-tight">
                        <b className="block truncate text-[15px] text-(--ap-ink)">{row.name}</b>
                        <span className="mt-0.5 block truncate text-[12px] text-(--ap-faint)">{row.reference}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <b className="block truncate text-[14px]">{row.label}</b>
                      {row.current ? <span className="mt-0.5 block truncate text-[13px] text-(--ap-muted)">Version {row.current.version}</span> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
                      <StatusChip tone={STATE[row.state]?.tone ?? "mute"}>{STATE[row.state]?.label ?? "Unavailable"}</StatusChip>
                      {row.current && row.canDecide && row.state === "available" ? (
                        <button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={() => { setNotice(""); setSelected(row); }}>
                          Review
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {data && data.total > PAGE ? (
            <nav aria-label="Document pages" className="mt-4 flex items-center justify-center gap-4">
              <button type="button" className="ap-btn ap-btn-s ap-btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="text-sm text-(--ap-muted)">Page {page} of {Math.ceil(data.total / PAGE)}</span>
              <button type="button" className="ap-btn ap-btn-s ap-btn-sm" disabled={page * PAGE >= data.total || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
            </nav>
          ) : null}
        </ListCard>
      )}
      {selected?.current ? (
        <ReviewDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onSaved={async (msg) => { setSelected(null); setNotice(msg); await load(); }}
        />
      ) : null}
    </div>
  );
}

function validGrant(next: OpenGrant, target: string) {
  const url = new URL(next.url);
  return url.origin === "https://lrkeihyqeuuxscmjxtqn.supabase.co" && !url.username && !url.password && !url.hash &&
    ["pdf", "jpg", "jpeg", "png"].some((ext) => url.pathname === `/storage/v1/object/sign/staff-document-clean/${target}/source.${ext}`) &&
    !!url.searchParams.get("token") && [...url.searchParams.keys()].every((key) => key === "token") &&
    Number.isFinite(Date.parse(next.expiresAt)) && Date.parse(next.expiresAt) > Date.now() && Date.parse(next.expiresAt) <= Date.now() + 125000;
}

function ReviewDrawer({ row, onClose, onSaved }: { row: HrQueueRowDto; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const current = row.current!;
  const [grant, setGrant] = useState<OpenGrant | null>(null);
  const [fileState, setFileState] = useState<"idle" | "loading" | "error">(row.canOpen ? "loading" : "idle");
  const [decision, setDecision] = useState<Decision>("verified");
  const [reason, setReason] = useState<ReasonCode | "">("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const openFile = useCallback(async () => {
    if (!row.canOpen) return;
    setFileState("loading"); setGrant(null);
    try {
      const next = await call<OpenGrant>("hr-open", { versionId: current.versionId, reason: "verify" });
      if (!validGrant(next, current.versionId)) throw new Error("invalid_reply");
      if (alive.current) { setGrant(next); setFileState("idle"); }
    } catch { if (alive.current) setFileState("error"); }
  }, [row.canOpen, current.versionId]);
  useEffect(() => { const t = setTimeout(() => void openFile(), 0); return () => clearTimeout(t); }, [openFile]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const needsReason = decision !== "verified";
  const ready = !needsReason || (!!reason && message.trim().length >= 3);
  async function save() {
    if (!row.canDecide || busy || !ready) return;
    setBusy(true); setProblem("");
    try {
      await call("hr-decide", {
        requestId: crypto.randomUUID(), versionId: current.versionId, expectedSeq: current.decisionSeq, decision,
        reasonCode: needsReason ? reason : null, message: needsReason ? message.trim() : null,
      });
      await onSaved(decision === "verified" ? `${row.label} verified for ${row.name}.` : `Your decision on ${row.label} was sent to ${row.name}.`);
    } catch {
      if (alive.current) { setBusy(false); setProblem("We couldn't confirm the review. Close this panel to see the latest status before trying again."); }
    }
  }
  const isPdf = grant?.mediaType === "application/pdf" || /\.pdf$/.test(grant ? new URL(grant.url).pathname : "");

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Document review">
      <button type="button" aria-label="Close review" onClick={() => !busy && onClose()} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-y-0 right-0 flex w-[min(560px,100vw)] flex-col bg-white shadow-2xl max-[719px]:inset-x-0 max-[719px]:top-auto max-[719px]:max-h-[92dvh] max-[719px]:w-full max-[719px]:rounded-t-2xl max-[719px]:pb-[env(safe-area-inset-bottom,0px)]">
        <span className="mx-auto mt-2 hidden h-1 w-10 rounded-full bg-(--ap-line) max-[719px]:block" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-(--ap-line) px-4 py-3">
          <h2 className="m-0 text-[17px] font-extrabold">Document review</h2>
          <button type="button" autoFocus onClick={onClose} disabled={busy} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-(--ap-line-2)" aria-label="Close review">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4">
            <div className="flex items-center gap-3">
              <AdminAvatar name={row.name} size={44} />
              <div className="min-w-0 leading-tight">
                <b className="block truncate text-[16px]">{row.name}</b>
                <span className="mt-0.5 block truncate text-[13px] text-(--ap-muted)">{row.reference} · {row.label} · Version {current.version}</span>
              </div>
            </div>

            {row.canOpen ? (
              <div className="overflow-hidden rounded-2xl border border-(--ap-line) bg-(--ap-tint-soft)">
                {fileState === "loading" ? (
                  <div className="ap-shimmer h-[360px]" role="status" aria-busy="true" aria-label="Loading the file" />
                ) : fileState === "error" || !grant ? (
                  <div className="p-6">
                    <EmptyState icon={Files} title="We couldn't show this file" description="The secure link could not be prepared. Try again in a moment."
                      action={<button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={() => void openFile()}>Try again</button>} />
                  </div>
                ) : isPdf ? (
                  <iframe title={`${row.label} for ${row.name}`} src={grant.url} className="block h-[60vh] min-h-[360px] w-full bg-white" referrerPolicy="no-referrer" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would proxy and cache it
                  <img src={grant.url} alt={`${row.label} for ${row.name}`} referrerPolicy="no-referrer" className="mx-auto block max-h-[60vh] w-auto max-w-full object-contain" onError={() => setFileState("error")} />
                )}
              </div>
            ) : null}
            <p className="m-0 text-[13px] text-(--ap-muted)">The file passed a safety check. Check that it is the right document and that the details are correct.</p>

            {row.canDecide ? (
              <div className="flex flex-col gap-3">
                <div>
                  <span id="doc-decision-label" className="mb-1.5 block text-[14px] font-semibold">Decision</span>
                  <SelectMenu id="doc-decision" label="Decision" value={decision} options={DECISIONS} onChange={(v) => setDecision(v as Decision)} />
                </div>
                {needsReason ? (
                  <>
                    <div>
                      <span className="mb-1.5 block text-[14px] font-semibold">Reason</span>
                      <SelectMenu id="doc-reason" label="Reason" value={reason} options={REASONS} placeholder="Choose a reason" onChange={(v) => setReason(v as ReasonCode)} />
                    </div>
                    <label className="block text-[14px] font-semibold">
                      Message to {row.name.split(" ")[0] || "the staff member"}
                      <textarea className="ap-input mt-1.5 block min-h-[96px] w-full" required minLength={3} maxLength={300} value={message} disabled={busy} onChange={(e) => setMessage(e.target.value)} placeholder="Tell them what to fix or upload again." />
                    </label>
                  </>
                ) : null}
                {problem ? <p role="alert" className="m-0 text-sm text-(--ap-rose)">{problem}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
        {row.canDecide ? (
          <div className="flex gap-2.5 border-t border-(--ap-line) px-4 py-3">
            <button type="button" className="ap-btn ap-btn-s flex-1" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="ap-btn ap-btn-p flex-1" disabled={busy || !ready} onClick={() => void save()}>{busy ? "Saving…" : "Save decision"}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A staff member's own documents on their profile (live): same rows and the same in-dashboard review drawer. */
export function LiveStaffDocumentRows({ reference, name }: { reference: string; name: string }) {
  const [rows, setRows] = useState<HrQueueRowDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<HrQueueRowDto | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    call<HrQueueDto>("hr-queue", { page: 1, pageSize: 50, state: "", search: (reference || name).slice(0, 80) }).then(
      (d) => { if (!cancelled) { setFailed(false); setRows(Array.isArray(d.items) ? d.items.filter((r) => (reference ? r.reference === reference : r.name === name)) : []); } },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [reference, name, tick]);
  if (failed) return <EmptyState icon={Files} title="We couldn't load documents" description="Check your connection, then try again." action={<button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={() => setTick((t) => t + 1)}>Try again</button>} />;
  if (!rows) return <div className="ap-shimmer h-[120px] rounded-2xl" role="status" aria-busy="true" aria-label="Loading documents" />;
  if (rows.length === 0) return <EmptyState icon={Files} title="No documents yet" description="Documents show here once they are uploaded or requested." />;
  return (
    <>
      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.slot} {...openRow(!!row.current && (row.canOpen || row.canDecide), () => setSelected(row))} className={`${row.current && (row.canOpen || row.canDecide) ? `${OPEN_ROW} hover:bg-(--ap-tint-soft)` : ""} flex min-h-[56px] flex-wrap items-center justify-between gap-3 border-t border-(--ap-line-2) px-1 py-3 first:border-t-0`}>
            <div className="min-w-0 leading-tight">
              <b className="block truncate text-[14px]">{row.label}</b>
              {row.current ? <span className="mt-0.5 block text-[13px] text-(--ap-muted)">Version {row.current.version}</span> : null}
            </div>
            <div className="flex items-center gap-3">
              <StatusChip tone={STATE[row.state]?.tone ?? "mute"}>{STATE[row.state]?.label ?? "Unavailable"}</StatusChip>
              {row.current && row.canDecide && row.state === "available" ? (
                <button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={() => setSelected(row)}>Review</button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {selected?.current ? <ReviewDrawer row={selected} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); setTick((t) => t + 1); }} /> : null}
    </>
  );
}
