"use client";

/**
 * Invitations tab (docs/contracts/auth-and-invitations.md section 4). Two
 * SEPARATE chips per row: invitation status (pending / accepted / expired /
 * revoked) and delivery status (not sent / queued / sent / failed). Actions
 * follow the contract table:
 *   pending + not sent      -> Send invitation, Edit email, Revoke
 *   pending + sent          -> Resend (cooldown until retryAt), Revoke
 *   pending + failed        -> Retry sending (cooldown), Edit email, Revoke
 *   expired / revoked       -> Issue replacement
 *   accepted                -> Manage access
 * Invitations are never sent automatically. Nothing is emailed in the demo.
 */
import { teamAccessMode } from "@/lib/admin/team-access/mode";
import { playAdminSound } from "@/lib/admin/sound";
import { useEffect, useState } from "react";
import { ANY, EMPTY_CARD, ListCard, ListToolbar, useBatch } from "@/components/admin/listKit";
import { Restricted } from "@/components/admin/offers/parts";
import { CancelButton, FIELD_LABEL, PrimaryButton, ReasonSheet, SheetFrame } from "@/components/admin/offers/Sheet";
import { RowMenu } from "@/components/admin/overview/RowMenu";
import { ShowMore } from "@/components/admin/ShowMore";
import { confirmAction } from "@/components/applicant/ConfirmDialog";
import { Mail, Search, X } from "@/components/applicant/icons";
import { EmptyState } from "@/components/applicant/primitives";
import { ErrorPanel } from "@/components/staff/ErrorPanel";
import { invitationTiming } from "@/lib/admin/team-access/invitation-presentation";
import { emailTypoSuggestion, emailsMatch } from "@/lib/admin/team-access/email-check";
import { AccessLinkSheet } from "./AccessLinkSheet";
import { InvitationDetailsSheet } from "./InvitationDetailsSheet";
import { getInvitationDetails, createAccessLink, replaceInvitation, resendInvitation, revokeInvitation, sendInvitation, updateInvitationEmail, useInvitations } from "@/lib/admin/team-access/hooks";
import type { AccessLink, Invitation, InvitationKind, InvitationStatus, TeamCapabilities } from "@/lib/admin/team-access/types";
import { INVITE_LABEL, INVITE_ORDER, KIND_LABEL, TEAM_HREF } from "./meta";

const MANAGE_TAB: Record<InvitationKind, string> = { internal: "internal", client: "clients", staff: "accounts" };

/** Re-renders once a second while a cooldown is running, so Resend enables itself at retryAt. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
const LINK_UNKNOWN = "We could not confirm the link was created. Reload this page, then create a new link.";
const wait = (ms: number) => (ms >= 60_000 ? `${Math.ceil(ms / 60_000)} min` : `${Math.max(1, Math.ceil(ms / 1000))} s`);

/** Redesign helpers (lead 2026-11-22). Status names stay the approved ones (Pending / Accepted / Expired / Revoked). */
const GROUPS: [InvitationStatus, string][] = [["pending", "Pending"], ["expired", "Expired"], ["accepted", "Accepted"], ["revoked", "Revoked"]];
const DOT: Record<InvitationStatus, string> = { pending: "#e3b341", accepted: "#3fb27f", expired: "#9a8a92", revoked: "#c4566f" };
const TAG: Record<InvitationKind, string> = {
  client: "bg-[rgba(63,178,127,.16)] text-[#1e7a52] dark:text-[#6fd3a4] [html[data-admin-theme=dark]_&]:text-[#6fd3a4]",
  internal: "bg-[rgba(120,140,255,.16)] text-[#3a4bc4] [html[data-admin-theme=dark]_&]:text-[#a9b6ff]",
  staff: "bg-[rgba(227,179,65,.18)] text-[#8a6510] [html[data-admin-theme=dark]_&]:text-[#f0c766]",
};
function initials(v: string): string {
  const parts = v.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function InvitationsList({ caps, onNotice }: { caps: TeamCapabilities; onNotice: (n: { kind: "ok" | "error"; text: string }) => void }) {
  const liveMode = teamAccessMode() === "live";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvitationStatus | "all">("all");
  const [kind, setKind] = useState<InvitationKind | "">("");
  // Load once (search / type only) and filter the status tab on screen, so switching tabs is instant (lead 2026-11-22).
  const live = useInvitations({ search, status: "", kind });
  const [last, setLast] = useState<typeof live.data>(null);
  if (live.data && live.data !== last) setLast(live.data);
  const page = live.data ?? last;
  const { limit, more } = useBatch(`${search}|${status}|${kind}`);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [details, setDetails] = useState<Invitation | null>(null);
  const [shownLink, setShownLink] = useState<{ name: string; link: AccessLink } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unknownLinks, setUnknownLinks] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const now = useNow(!!page?.rows.some((r) => r.delivery.retryAt));
  const narrowed = !!search || !!kind || status !== "all";
  const clear = () => {
    setSearch("");
    setKind("");
    setStatus("all");
  };

  if (live.status === "error") return <ErrorPanel title="We could not load the invitations" retry={live.retry} />;
  if (live.status === "restricted") return <Restricted what="Invitations" />;
  if (!page)
    return (
      <div role="status" aria-busy="true" aria-label="Loading invitations" className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ap-shimmer h-[72px] rounded-2xl" />
        ))}
      </div>
    );
  if (page.workspaceEmpty) {
    return (
      <div className={EMPTY_CARD}>
        <EmptyState icon={Mail} title="No invitations yet" description={liveMode ? "Invitations you create appear here with their status and delivery." : "Invitations you create appear here with their status and delivery. Email delivery is connected later."} />
      </div>
    );
  }

  const canFor = (k: InvitationKind) => (k === "internal" ? caps.canInviteInternal : k === "client" ? caps.canInviteClient : caps.canInviteStaff);
  const fail = () => onNotice({ kind: "error", text: "We could not confirm the change. Reload Invitations before trying again." });

  async function send(i: Invitation) {
    if (busy) return;
    const ok = await confirmAction({
      tone: "neutral",
      title: `Send the invitation to ${i.name}?`,
      description: "Invitations are never sent automatically. This sends it now.",
      points: liveMode ? ["Email delivery must be enabled before this can be queued."] : ["Email delivery is connected later, so in the demo this is recorded only."],
      confirmLabel: "Send invitation",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await sendInvitation(i.id, i.revision);
      playAdminSound("saved");
      onNotice({ kind: "ok", text: liveMode ? `The invitation to ${i.name} was queued for delivery.` : `The invitation to ${i.name} was sent (recorded only).` });
    } catch {
      fail();
    } finally { setBusy(false); }
  }
  async function resend(i: Invitation) {
    if (busy) return;
    const retry = i.delivery.status === "failed";
    const ok = await confirmAction({
      tone: "neutral",
      title: retry ? `Retry sending to ${i.name}?` : `Resend the invitation to ${i.name}?`,
      description: liveMode ? "This creates a new invitation link and queues an email. The previous link stops working." : "The same link is sent again. The button then stays disabled for a short cooldown.",
      points: liveMode ? ["Email delivery must be enabled. Queued does not mean delivered."] : ["Email delivery is connected later, so nothing is sent yet."],
      confirmLabel: retry ? "Retry sending" : "Resend",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await resendInvitation(i.id, i.revision);
      playAdminSound("saved");
      onNotice({ kind: "ok", text: liveMode ? `The invitation to ${i.name} was queued for delivery.` : `The invitation to ${i.name} was ${retry ? "sent again" : "resent"} (recorded only).` });
    } catch (e) {
      if (e instanceof Error && e.message === "cooldown") onNotice({ kind: "error", text: "Please wait for the cooldown to finish before resending." });
      else fail();
    } finally { setBusy(false); }
  }
  async function makeLink(i: Invitation) {
    if (busy) return; // a double click cannot submit twice (discrete clicks re-render between taps)
    setBusy(true);
    try {
      if (unknownLinks.includes(i.id)) {
        onNotice({ kind: "error", text: LINK_UNKNOWN });
        return;
      }
      const again = i.delivery.status === "copied";
      const ok = await confirmAction({
        tone: "neutral",
        title: again ? `Create a new access link for ${i.name}?` : `Create an access link for ${i.name}?`,
        description: "You share the link yourself. It is shown once and works one time.",
        points: again ? ["The previous link stops working."] : undefined,
        confirmLabel: "Create access link",
      });
      if (!ok) return;
      try {
        const link = await createAccessLink(i.id, i.revision);
        playAdminSound("saved");
        setShownLink({ name: i.name, link });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "cooldown") onNotice({ kind: "error", text: "Please wait a moment before creating another link." });
        else if (msg === "outcome_unknown" || msg === "outcome-unknown") {
          // Never retried with the same request: the person must reload, then create a new link.
          setUnknownLinks((l) => [...l, i.id]);
          onNotice({ kind: "error", text: LINK_UNKNOWN });
        } else fail();
      }
    } finally {
      setBusy(false);
    }
  }
  async function replace(i: Invitation) {
    if (busy) return;
    const ok = await confirmAction({
      tone: "neutral",
      title: `Issue a replacement for ${i.name}?`,
      description: "A new invitation is created with a new link and expiry. It is not sent until you choose Send invitation.",
      confirmLabel: "Issue replacement",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await replaceInvitation(i.id, i.revision);
      playAdminSound("saved");
      onNotice({ kind: "ok", text: `A replacement invitation for ${i.name} was created. It has not been sent yet.` });
    } catch {
      fail();
    } finally { setBusy(false); }
  }
  async function revoke(reason: string) {
    if (!revoking) return;
    setBusy(true);
    setErr(null);
    try {
      await revokeInvitation(revoking.id, reason, revoking.revision);
      playAdminSound("rejected");
      onNotice({ kind: "ok", text: `The invitation to ${revoking.name} was revoked.` });
      setRevoking(null);
    } catch {
      setErr("We could not confirm the change. Reload Invitations before trying again.");
    } finally {
      setBusy(false);
    }
  }
  async function saveEmail(email: string) {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      await updateInvitationEmail(editing.id, email, editing.revision);
      onNotice({ kind: "ok", text: `The address for ${editing.name} was changed. The invitation has not been sent yet.` });
      setEditing(null);
    } catch (e) {
      setErr(e instanceof Error && e.message === "duplicate" ? "Another pending invitation already uses that address." : "We could not confirm the change. Reload Invitations before trying again.");
    } finally {
      setBusy(false);
    }
  }

  async function loadActions(i: Invitation) {
    if (busy || !page) return;
    setBusy(true);
    try {
      const updated = await getInvitationDetails(i.id, i.revision);
      live.setData({ ...page, rows: page.rows.map((row) => row.id === i.id ? updated : row) });
    } catch {
      onNotice({ kind: "error", text: "We could not confirm the available actions. Reload Invitations and check again." });
    } finally { setBusy(false); }
  }

  /** Primary action as a visible button (so a cooldown can show); the rest in the menu. */
  const actionsFor = (i: Invitation) => {
    const can = canFor(i.kind);
    const left = i.delivery.retryAt ? Date.parse(i.delivery.retryAt) - now : 0;
    const inCooldown = left > 0;
    const menu: { label: string; onSelect?: () => void; href?: string; tone?: "default" | "danger" }[] = [];
    let primary: React.ReactNode = null;
    const btn = "ap-btn ap-btn-s ap-btn-sm whitespace-nowrap";
    if (liveMode && can && i.status !== "accepted" && !i.actions) {
      primary = <button type="button" className={btn} disabled={busy} onClick={() => void loadActions(i)}>{busy ? "Checking..." : "Check actions"}</button>;
    } else if (i.status === "accepted" && !liveMode) {
      menu.push({ label: "Manage access", href: `${TEAM_HREF}?tab=${MANAGE_TAB[i.kind]}` });
    } else if (can && (!liveMode || i.actions?.replace === true) && (i.status === "expired" || i.status === "revoked")) {
      primary = (
        <button type="button" className={btn} disabled={busy} onClick={() => void replace(i)}>
          Issue replacement
        </button>
      );
    } else if (can && i.status === "pending") {
      const edit = {
        label: "Edit email",
        onSelect: () => {
          setErr(null);
          setEditing(i);
        },
      };
      const revokeItem = {
        label: "Revoke",
        tone: "danger" as const,
        onSelect: () => {
          setErr(null);
          setRevoking(i);
        },
      };
      const linkItem = { label: i.delivery.status === "copied" ? "Create a new access link" : "Create access link", onSelect: () => void makeLink(i) };
      if (i.delivery.status === "not-sent") {
        primary = (
          <button type="button" className={btn} disabled={busy || (liveMode && i.actions?.send !== true)} onClick={() => void send(i)}>
            Send invitation
          </button>
        );
        if (!liveMode || i.actions?.copyLink === true) menu.push(linkItem);
        if (!liveMode || i.actions?.edit === true) menu.push(edit);
        if (!liveMode || i.actions?.revoke === true) menu.push(revokeItem);
      } else {
        const label = i.delivery.status === "failed" ? "Retry sending" : "Resend";
        primary = i.delivery.status === "copied" ? (
          <button type="button" className={btn} disabled={busy || inCooldown || (liveMode && i.actions?.copyLink !== true)} onClick={() => void makeLink(i)}>
            {inCooldown ? `New link in ${wait(left)}` : "New access link"}
          </button>
        ) : (
          <button type="button" className={btn} disabled={busy || inCooldown || (liveMode && i.actions?.resend !== true)} onClick={() => void resend(i)}>
            {inCooldown ? `${label} in ${wait(left)}` : label}
          </button>
        );
        if (i.delivery.status !== "copied" && (!liveMode || i.actions?.copyLink === true)) menu.push(linkItem);
        if (i.delivery.status === "failed" && (!liveMode || i.actions?.edit === true)) menu.push(edit);
        if (!liveMode || i.actions?.revoke === true) menu.push(revokeItem);
      }
    }
    // Redesign (lead 2026-11-22): the row opens the details; "View details" stays first in the menu for keyboards.
    const items = [{ label: "View details", onSelect: () => setDetails(i) }, ...menu];
    return (
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {primary}
        <RowMenu label={`More actions for the invitation to ${i.name}`} items={items} />
      </div>
    );
  };
  const dates = invitationTiming;
  const tabRows = status === "all" ? page.rows : page.rows.filter((r) => r.status === status);
  const shown = tabRows.slice(0, limit);

  return (
    <div>
      <ListCard flat title="Invitations" summary={`${tabRows.length} ${tabRows.length === 1 ? "invitation" : "invitations"}${narrowed ? " match your filters" : ""}`}>
      <ListToolbar
        tabsLabel="Filter invitations by status"
        tabs={INVITE_ORDER.map((st) => ({ key: st, label: st === "all" ? "All" : INVITE_LABEL[st], count: page.statusCounts[st] }))}
        tab={status}
        onTab={(k: InvitationStatus | "all") => setStatus(k)}
        search={{ value: search, onChange: setSearch, label: "Search invitations", placeholder: "Search name, email or role" }}
        filters={[{ key: "kind", label: "Invitation type", value: kind || ANY, onChange: (v) => setKind(v === ANY ? "" : (v as InvitationKind)), options: [{ value: ANY, label: "All types" }, ...(Object.keys(KIND_LABEL) as InvitationKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))] }]}
        sort={null}
      />
      <div className={`@container transition-opacity ${live.status === "loading" ? "opacity-60" : ""}`}>
        {tabRows.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={Search}
              title="No invitations match these filters"
              description="Check the spelling, or clear a filter."
              action={
                narrowed ? (
                  <button type="button" onClick={clear} className="ap-btn ap-btn-s ap-btn-sm">
                    <X className="size-4" aria-hidden="true" /> Clear search and filters
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Redesign (lead 2026-11-22): grouped by status, two-line rows, role tag, status dot, one action + menu.
                The row opens the details. Everything the old table showed is in the row or the details panel. */}
            <div className="flex flex-col gap-4">
              {GROUPS.map(([st, title]) => {
                const rows = shown.filter((i) => i.status === st);
                if (!rows.length) return null;
                return (
                  <section key={st} aria-label={`${title} invitations`} className="overflow-hidden rounded-[20px] border border-(--ap-line) bg-(--ap-surface)">
                    <h3 className="m-0 px-5 pt-3.5 pb-1.5 text-[12px] font-bold tracking-[0.08em] text-(--ap-muted) uppercase">{title} · {rows.length}</h3>
                    <ul className="m-0 list-none p-0">
                      {rows.map((i) => {
                        const who = i.name && i.name !== i.email ? i.name : i.email;
                        const soon = i.status === "pending" && i.expiresAt && Date.parse(i.expiresAt) - now < 2 * 86_400_000;
                        return (
                          <li key={i.id} className="border-t border-(--ap-line) first:border-t-0">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setDetails(i)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetails(i); } }}
                              aria-label={`Open the invitation to ${who}`}
                              className="group flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-(--ap-tint-soft) focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--ap-violet) max-[767px]:flex-wrap max-[767px]:gap-3 max-[767px]:px-4"
                            >
                              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--ap-tint) text-[14px] font-bold text-(--ap-violet)">{initials(who)}</span>
                              <div className="min-w-0 flex-1 leading-tight">
                                <span className="flex min-w-0 items-center gap-2">
                                  <b className="truncate text-[16px]" title={i.email}>{who}</b>
                                  <span className={`inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[12px] font-bold ${TAG[i.kind]}`}>{KIND_LABEL[i.kind]}</span>
                                </span>
                                <span className="mt-1 block truncate text-[14px] text-(--ap-muted)" title={`${i.roleLabel} · ${i.scopeLabel}`}>
                                  {i.kind === "internal" ? `${i.roleLabel} · ` : ""}{i.scopeLabel} · <span className={soon ? "font-bold text-(--ap-warn)" : ""}>{dates(i)}</span>
                                </span>
                                {i.delivery.status === "failed" ? <span className="mt-1 block text-[13px] font-semibold text-(--ap-rose)">Email not delivered{i.delivery.failureReason ? `: ${i.delivery.failureReason}` : ""}</span> : null}
                              </div>
                              <span className="flex min-w-[120px] items-center gap-2 text-[14px] text-(--ap-ink-2) max-[767px]:min-w-0">
                                <span aria-hidden="true" className="size-2 rounded-full" style={{ background: DOT[i.status] }} />
                                {INVITE_LABEL[i.status]}
                              </span>
                              <div className="max-[767px]:w-full">{actionsFor(i)}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
      <ShowMore shown={limit} total={tabRows.length} onMore={more} onClear={narrowed ? clear : null} />
      <p className="mt-3 text-[13px] text-(--ap-muted)">{liveMode ? "Create an invitation, then choose email delivery or an access link. Queued email is not confirmation of delivery." : "Invitations are never sent automatically. Email delivery is connected later, so sending is recorded only."}</p>
      </ListCard>

      {details ? <InvitationDetailsSheet key={`${details.id}:${details.revision}`} invitation={details} onClose={() => setDetails(null)} actions={actionsFor(details)} /> : null}
      {shownLink ? <AccessLinkSheet name={shownLink.name} link={shownLink.link} onClose={() => setShownLink(null)} /> : null}
      {editing ? <EmailSheet inv={editing} busy={busy} error={err} onCancel={() => setEditing(null)} onSubmit={saveEmail} /> : null}
      {revoking ? (
        <ReasonSheet
          title={`Revoke the invitation to ${revoking.name}`}
          description="The link stops working. You can issue a replacement later."
          label="Reason for revoking"
          confirmLabel="Revoke invitation"
          danger
          busy={busy}
          error={err}
          onCancel={() => setRevoking(null)}
          onSubmit={revoke}
        />
      ) : null}
    </div>
  );
}

function EmailSheet({ inv, busy, error, onCancel, onSubmit }: { inv: Invitation; busy: boolean; error: string | null; onCancel: () => void; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState(inv.email);
  const [confirmEmail, setConfirmEmail] = useState("");
  const confirmOk = emailsMatch(email, confirmEmail);
  const suggestion = emailTypoSuggestion(email);
  const ok = /^\S+@\S+\.\S+$/.test(email.trim()) && email.trim().toLowerCase() !== inv.email && confirmOk;
  return (
    <SheetFrame
      title={`Edit the email for ${inv.name}`}
      description="The invitation goes back to Not sent. Choose Send invitation again once the address is right."
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <CancelButton onClick={onCancel} disabled={busy} />
          <PrimaryButton disabled={!ok || busy} onClick={() => onSubmit(email.trim())}>
            {busy ? "Working..." : "Save address"}
          </PrimaryButton>
        </>
      }
    >
      <label htmlFor="inv-email" className={FIELD_LABEL}>
        Email address
      </label>
      <input id="inv-email" type="email" className="ap-input mt-1.5" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
      <div aria-live="polite">
        {suggestion ? (
          <p className="mt-1 text-[13px] text-(--ap-muted)">
            Did you mean{" "}
            <button type="button" aria-label={`Use ${suggestion}`} className="font-semibold text-(--ap-violet) underline underline-offset-2" onClick={() => { setEmail(suggestion); setConfirmEmail(suggestion); }}>
              {suggestion}
            </button>
            ?
          </p>
        ) : null}
      </div>
      <label htmlFor="inv-email-confirm" className={FIELD_LABEL}>
        Confirm email address
      </label>
      <input id="inv-email-confirm" type="email" className="ap-input mt-1.5" value={confirmEmail} maxLength={120} autoComplete="off" aria-invalid={!!confirmEmail && !confirmOk} aria-describedby={confirmEmail && !confirmOk ? "inv-email-confirm-err" : undefined} onChange={(e) => setConfirmEmail(e.target.value)} />
      {confirmEmail && !confirmOk ? <p id="inv-email-confirm-err" className="mt-1 text-[13px] font-semibold text-(--ap-rose)">The two emails don&apos;t match.</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-(--ap-rose)">
          {error}
        </p>
      ) : null}
    </SheetFrame>
  );
}
