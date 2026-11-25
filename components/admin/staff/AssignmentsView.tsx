"use client";

/**
 * Assignments (HR, spec 9 / 28.3): staff <-> client / outlet / role / department
 * with start date and history. One StaffAssignment record per placement; the
 * directory, Staff 360 and this page all read the same record (never copies).
 * Reuses: ClientAvatar, StatusChip, SearchField, FilterSelect, EmptyState,
 * PageHeading, confirmAction, SelectMenu, ClientPageSkeleton/Error.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { confirmAction } from "@/components/applicant/ConfirmDialog";
import { Clock3, Plus, Search, X } from "@/components/applicant/icons";
import { Store } from "@/components/client/icons";
import { EmptyState, PageHeading } from "@/components/applicant/primitives";
import { AdminAvatar } from "@/components/admin/AdminAvatar";
import { ListCard, ListToolbar, useBatch } from "@/components/admin/listKit";
import { rowOpenClick } from "@/components/admin/RowClick";
import { ShowMore } from "@/components/admin/ShowMore";
import { cmpIso } from "@/lib/admin/sort";
import { StatusChip } from "@/components/client/StatusChip";
import { formatDate, formatDateShort } from "@/lib/applicant/time";
import { assignStaff, useAssignments } from "@/lib/admin/staff/hooks";
import type { AssignInput, AssignmentRow, AssignmentsPage } from "@/lib/admin/staff/types";
import { AssignSheet } from "./AssignSheet";
import { ANY, AdminState, staffHref, useUrlParams, withAny } from "./parts";
import { explainCaught } from "@/lib/shared/error-messages";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A-Z" },
];

export function AssignmentsView() {
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const url = useUrlParams();
  const query = { search: url.get("q"), clientId: url.get("client") };
  const sort = SORTS.some((o) => o.value === url.get("sort")) ? url.get("sort") : "newest";
  const batch = useBatch([query.search, query.clientId, sort].join("|"));
  const live = useAssignments(query);
  const [shown, setShown] = useState<AssignmentsPage | null>(null);
  if (live.data && live.data !== shown) setShown(live.data);
  const page = live.data ?? shown;
  const detailsRow = detailsFor ? (page?.rows.find((x) => x.staffId === detailsFor) ?? null) : null;

  const [searchText, setSearchText] = useState(query.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const onSearch = (v: string) => {
    setSearchText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => url.set({ q: v.trim() || undefined }), 250);
  };

  // ?reassign=<staffId> (from Staff 360) opens the sheet once; closing clears it.
  const reassignParam = url.get("reassign");
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [handled, setHandled] = useState("");
  if (reassignParam && reassignParam !== handled && page) {
    setHandled(reassignParam);
    setSheetFor(reassignParam);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const close = () => {
    setSheetFor(null);
    setError(null);
    if (reassignParam) url.set({ reassign: undefined });
  };

  async function submit(input: AssignInput) {
    const ok = await confirmAction({
      tone: "neutral",
      title: "Confirm this assignment?",
      description: "The current assignment ends and the new one starts on the date you chose. Both stay in the history with your reason.",
      confirmLabel: "Confirm",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await assignStaff(input);
      setDone("Assignment saved. The history has been updated.");
      live.retry();
      close();
    } catch (e) {
      setError(explainCaught(e, "That could not be saved. Nothing was changed.", "records"));
    } finally {
      setBusy(false);
    }
  }

  const narrowing = !!(query.search || query.clientId);
  // Compared on the full assignment start timestamp; people awaiting assignment have none and sort last.
  const sorted = [...(page?.rows ?? [])].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : cmpIso(a.current?.start, b.current?.start, sort === "oldest" ? "asc" : "desc")));

  return (
    <AdminState status={page ? "ready" : live.status} title="Assignments" what="assignments" retry={live.retry}>
      {!page ? null : (
        <div>
          <PageHeading
            title="Assignments"
            right={
              !page.workspaceEmpty || page.facets.clients.length ? (
                <button type="button" className="ap-btn ap-btn-p h-11 px-5 text-[15px] font-semibold text-white!" onClick={() => setSheetFor("")}>
                  <Plus className="size-4" aria-hidden="true" /> Assign / Reassign
                </button>
              ) : undefined
            }
          />
          {done ? (
            <p role="status" className="mb-3 rounded-xl bg-(--ap-ok-bg) px-4 py-2.5 text-[14px] font-semibold text-(--ap-ok)">
              {done}
            </p>
          ) : null}
          {page.workspaceEmpty ? (
            <div className="ap-card rounded-[20px] p-6 min-[768px]:p-8">
              <EmptyState icon={Store} title="No assignments yet" description="Approved staff appear here, awaiting a client and outlet." />
            </div>
          ) : (
            <>
              <ListCard title="Assignments" summary={`${page.rows.length} ${page.rows.length === 1 ? "person" : "people"}${narrowing ? " match your filters" : ""}`}>
              <ListToolbar
                tabsLabel="Assignments"
                search={{ value: searchText, onChange: onSearch, label: "Search assignments", placeholder: "Search name, reference, client or outlet" }}
                filters={[{ key: "client", label: "Client", value: query.clientId || ANY, onChange: (v) => url.set({ client: v === ANY ? undefined : v }), options: withAny("All clients", page.facets.clients.map((c) => ({ value: c.id, label: c.name }))) }]}
                sort={{ value: sort, options: SORTS, onChange: (v) => url.set({ sort: v === "newest" ? undefined : v }) }}
              />
              <div className={`@container transition-opacity ${live.status === "loading" ? "opacity-60" : ""}`}>
                {page.rows.length === 0 ? (
                  <div className="py-6">
                    <EmptyState
                      icon={Search}
                      title="No assignments match"
                      description="Try a different name, reference or client."
                      action={
                        narrowing ? (
                          <button type="button" className="ap-btn ap-btn-s ap-btn-sm" onClick={() => { setSearchText(""); url.set({ q: undefined, client: undefined }); }}>
                            <X className="size-4" aria-hidden="true" /> Clear search and filters
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <ul className="m-0 flex list-none flex-col p-0">
                    {sorted.slice(0, batch.limit).map((r) => (
                      <Row key={r.staffId} r={r} onReassign={() => setSheetFor(r.staffId)} onView={() => setDetailsFor(r.staffId)} />
                    ))}
                  </ul>
                )}
              </div>
              <ShowMore shown={Math.min(batch.limit, sorted.length)} total={sorted.length} onMore={batch.more} onClear={narrowing ? () => { setSearchText(""); url.set({ q: undefined, client: undefined }); } : null} />
              </ListCard>
            </>
          )}
          {detailsRow ? (
            <AssignmentDetailsSheet
              r={detailsRow}
              onClose={() => setDetailsFor(null)}
              onReassign={() => { setDetailsFor(null); setSheetFor(detailsRow.staffId); }}
            />
          ) : null}
          {sheetFor !== null ? <AssignSheet people={page.rows} facets={page.facets} initialStaffId={sheetFor} busy={busy} error={error} onCancel={close} onSubmit={submit} /> : null}
        </div>
      )}
    </AdminState>
  );
}

function Row({ r, onReassign, onView }: { r: AssignmentRow; onReassign: () => void; onView: () => void }) {
  const c = r.current;
  return (
    // Lead 2026-11-24: the whole row opens Assignment details (no separate "View details" button). The name is the
    // keyboard target (a real button: Enter/Space). Reassign and the History toggle keep their own behaviour.
    <li onClick={rowOpenClick(onView)} className="ad-clickrow min-w-0 cursor-pointer border-t border-(--ap-line-2) px-2 py-3 first:border-t-0 hover:bg-(--ap-tint-soft) @min-[760px]:min-h-[68px]">
      <div className="flex flex-col gap-3 @min-[760px]:flex-row @min-[760px]:items-center @min-[760px]:gap-5">
        <div className="flex min-w-0 items-center gap-3 @min-[760px]:w-[32%]">
          <AdminAvatar name={r.name} size={40} viewable />
          <div className="min-w-0 leading-tight">
            <button type="button" onClick={onView} aria-label={`Open assignment details for ${r.name}`} className="block max-w-full truncate rounded text-left text-[15px] font-bold text-(--ap-ink) hover:text-(--ap-violet) focus-visible:outline-2 focus-visible:outline-(--ap-violet)">
              {r.name}
            </button>
            <span className="mt-0.5 block truncate text-[12px] text-(--ap-faint)" title={r.reference}>{r.reference}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-[14px] leading-tight">
          {c ? (
            <>
              <b className="block truncate" title={`${c.client}, ${c.outlet}`}>
                {c.client}, {c.outlet}
              </b>
              <span className="mt-0.5 block truncate text-[13px] text-(--ap-muted)" title={roleLine(c)}>
                {roleLine(c)}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-(--ap-faint)">Since {formatDate(c.start)}</span>
            </>
          ) : (
            <StatusChip tone="warn">Awaiting assignment</StatusChip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {c ? <StatusChip tone="ok">Current</StatusChip> : null}
          <button type="button" onClick={(e) => { e.stopPropagation(); onReassign(); }} className="ap-btn ap-btn-s ap-btn-sm h-10">
            {c ? "Reassign" : "Assign"}
          </button>
        </div>
      </div>
      {r.history.length > 0 ? (
        <details data-no-row className="mt-3 cursor-auto border-t border-(--ap-line-2) pt-2.5">
          <summary className="cursor-pointer text-[13px] font-bold text-(--ap-violet)">History ({r.history.length})</summary>
          <ul className="mt-2.5 flex flex-col gap-2">
            {r.history.map((h) => (
              <li key={h.id} className="border-l-2 border-(--ap-tint-2) pl-3.5 text-[14px] leading-snug">
                <b className="block break-words">
                  {h.client}, {h.outlet}{h.role ? ` · ${h.role}` : ""}
                </b>
                <span className="text-(--ap-muted)">
                  {formatDateShort(h.start)} - {h.end ? formatDateShort(h.end) : "present"}
                  {h.reason ? ` · ${h.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/** "Chef · Kitchen", or just "Chef" when no department is recorded (never a dangling dot). */
const roleLine = (a: { role: string; department: string }) => [a.role, a.department].filter((x) => x && x.trim()).join(" · ") || "Role not set";

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[13px] font-bold tracking-wide text-(--ap-muted) uppercase">{label}</div>
      <div className="text-[15px] wrap-anywhere">{children}</div>
    </div>
  );
}

/**
 * Assignment details in the SAME approved side panel as Inbox "Case details" / Invitation details: 380px right drawer
 * (bottom sheet on phones), header with close, uppercase field labels, history with icon circles, actions at the bottom.
 * Lead 2026-11-24: see the details here without going back to the Staff directory.
 */
function AssignmentDetailsSheet({ r, onClose, onReassign }: { r: AssignmentRow; onClose: () => void; onReassign: () => void }) {
  const c = r.current;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const past = r.history.filter((h) => !c || h.id !== c.id);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Assignment details">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-y-0 right-0 flex w-[min(380px,100vw)] flex-col bg-white shadow-2xl max-[719px]:inset-x-0 max-[719px]:top-auto max-[719px]:max-h-[85dvh] max-[719px]:w-full max-[719px]:rounded-t-2xl max-[719px]:pb-[env(safe-area-inset-bottom,0px)]">
        <span className="mx-auto mt-2 hidden h-1 w-10 rounded-full bg-(--ap-line) max-[719px]:block" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-(--ap-line) px-4 py-3">
          <h2 className="m-0 text-[17px] font-extrabold">Assignment details</h2>
          <button type="button" autoFocus onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-(--ap-line-2)" aria-label="Close details">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4">
            <div className="flex items-center gap-3">
              <AdminAvatar name={r.name} size={44} />
              <div className="min-w-0 leading-tight">
                <b className="block truncate text-[16px]">{r.name}</b>
                <span className="mt-0.5 block truncate text-[13px] text-(--ap-muted)">{r.reference}</span>
              </div>
            </div>
            {c ? (
              <>
                <DetailField label="Status">
                  <StatusChip tone="ok">Current</StatusChip>
                </DetailField>
                <DetailField label="Client">{c.client || "Not set"}</DetailField>
                <DetailField label="Outlet">{c.outlet || "Not set"}</DetailField>
                <DetailField label="Role">{c.role || "Not set"}</DetailField>
                <DetailField label="Department">{c.department && c.department.trim() ? c.department : "Not set yet"}</DetailField>
                <DetailField label="Start date">{c.start ? formatDate(c.start) : "Not set"}</DetailField>
                {c.reason ? <DetailField label="Reason">{c.reason}</DetailField> : null}
              </>
            ) : (
              <DetailField label="Status">
                <StatusChip tone="warn">Awaiting assignment</StatusChip>
              </DetailField>
            )}
            <div>
              <div className="mb-2 text-[13px] font-bold tracking-wide text-(--ap-muted) uppercase">History</div>
              {past.length === 0 ? (
                <p className="m-0 text-[14px] text-(--ap-muted)">No earlier assignments.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {past.map((h) => (
                    <li key={h.id} className="flex gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--ap-tint) text-(--ap-violet)">
                        <Clock3 className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 text-[14px] leading-snug">
                        <b className="block break-words">
                          {h.client}, {h.outlet}
                          {h.role ? ` · ${h.role}` : ""}
                        </b>
                        <span className="text-(--ap-muted)">
                          {formatDateShort(h.start)} - {h.end ? formatDateShort(h.end) : "present"}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-(--ap-line) px-4 py-3">
          <Link href={staffHref(r.staffId)} className="ap-btn ap-btn-o flex-1">
            Full profile
          </Link>
          <button type="button" onClick={onReassign} className="ap-btn ap-btn-p flex-1">
            {c ? "Reassign" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
