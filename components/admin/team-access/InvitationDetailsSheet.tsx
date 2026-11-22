"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getInvitationDetails } from "@/lib/admin/team-access/hooks";
import { teamAccessMode } from "@/lib/admin/team-access/mode";
import { invitationCreator, invitationDeliveryNote, invitationTiming } from "@/lib/admin/team-access/invitation-presentation";
import type { Invitation, InvitationKind, InvitationStatus } from "@/lib/admin/team-access/types";
import { formatDate } from "@/lib/applicant/time";
import { DELIVERY_LABEL, INVITE_LABEL, KIND_LABEL } from "./meta";

/**
 * Invitation details as a SIDE PANEL (lead 2026-11-22, from the approved redesign preview): header with initials, name
 * and email; status + type; the facts in one soft card; a short timeline; the available actions pinned at the bottom.
 * The link itself is never shown again (it is stored only as a hash); a new link replaces it.
 */
const DOT: Record<InvitationStatus, string> = { pending: "#e3b341", accepted: "#3fb27f", expired: "#9a8a92", revoked: "#c4566f" };
const TAG: Record<InvitationKind, string> = {
  client: "bg-[rgba(63,178,127,.16)] text-[#1e7a52] [html[data-admin-theme=dark]_&]:text-[#6fd3a4]",
  internal: "bg-[rgba(120,140,255,.16)] text-[#3a4bc4] [html[data-admin-theme=dark]_&]:text-[#a9b6ff]",
  staff: "bg-[rgba(227,179,65,.18)] text-[#8a6510] [html[data-admin-theme=dark]_&]:text-[#f0c766]",
};
function initials(v: string): string {
  const parts = v.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function InvitationDetailsSheet({ invitation, onClose, actions }: { invitation: Invitation; onClose: () => void; actions?: ReactNode }) {
  const live = teamAccessMode() === "live";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; item: Invitation | null } | null>(null);
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    getInvitationDetails(invitation.id, invitation.revision).then(
      (item) => { if (!cancelled) setResult({ attempt, item }); },
      () => { if (!cancelled) setResult({ attempt, item: null }); },
    );
    return () => { cancelled = true; };
  }, [live, invitation.id, invitation.revision, attempt]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const current = result?.attempt === attempt ? result : null;
  const item = live && current?.item ? current.item : invitation;
  const loading = live && !current;
  const failed = live && current?.item === null;
  const who = item.name && item.name !== item.email ? item.name : item.email || item.name;
  const expiresOk = item.expiresAt && Number.isFinite(Date.parse(item.expiresAt));
  const expiry = item.status === "pending" ? (expiresOk ? formatDate(item.expiresAt as string) : "Unavailable") : item.status === "expired" ? "Expired" : item.status === "accepted" ? "Used" : "No longer valid";

  const facts: [string, string][] = [
    ...(item.kind === "internal" ? [["Role", `${item.roleLabel}${item.jobTitle ? ` · ${item.jobTitle}` : ""}`] as [string, string]] : []),
    ["Access", item.scopeLabel],
    ["Invited by", invitationCreator(item).replace(/^Created by /, "")],
    ["Link expires", expiry],
    ["Delivery", `${DELIVERY_LABEL[item.delivery.status]}${invitationDeliveryNote(item) ? `. ${invitationDeliveryNote(item)}` : ""}`],
    ...(item.reference ? [["Reference", item.reference] as [string, string]] : []),
  ];
  const timeline: [string, string][] = [
    ...(item.status !== "pending" ? [[INVITE_LABEL[item.status], invitationTiming(item)] as [string, string]] : []),
    ...(item.resendCount ? [[`Sent again ${item.resendCount}×`, ""] as [string, string]] : []),
    ["Invitation created", item.invitedAt && Number.isFinite(Date.parse(item.invitedAt)) ? formatDate(item.invitedAt) : ""],
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Invitation for ${who}`}>
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 cursor-default bg-[rgba(10,4,8,.5)]" />
      <aside className="absolute top-0 right-0 bottom-0 flex w-[440px] max-w-full flex-col gap-5 overflow-y-auto border-l border-(--ap-line) bg-(--ap-surface) p-7 shadow-[-20px_0_60px_rgba(0,0,0,.25)] max-[560px]:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-(--ap-tint) text-[18px] font-bold text-(--ap-violet)">{initials(who)}</span>
            <div className="min-w-0">
              <h2 className="ap-serif m-0 truncate text-[26px] leading-tight">{who}</h2>
              {item.email && item.email !== who ? <p className="m-0 mt-0.5 truncate text-[14px] text-(--ap-muted)">{item.email}</p> : null}
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--ap-tint-soft) text-(--ap-ink) hover:bg-(--ap-tint)">✕</button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[15px]">
          <span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: DOT[item.status] }} />{INVITE_LABEL[item.status]}</span>
          <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-bold ${TAG[item.kind]}`}>{KIND_LABEL[item.kind]}</span>
        </div>

        {loading ? <p role="status" className="m-0 text-sm text-(--ap-muted)">Checking current details...</p> : null}
        {failed ? (
          <div role="alert" className="text-sm text-(--ap-rose)">
            <p className="m-0">We could not refresh this invitation. The saved details are shown.</p>
            <button type="button" className="ap-btn ap-btn-s ap-btn-sm mt-2" onClick={() => setAttempt((v) => v + 1)}>Try again</button>
          </div>
        ) : null}

        <dl className="m-0 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 rounded-2xl border border-(--ap-line) bg-(--ap-tint-soft) p-4 text-[15px]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-(--ap-muted)">{k}</dt>
              <dd className="m-0 break-words text-(--ap-ink)">{v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <h3 className="m-0 mb-2 text-[12px] font-bold tracking-[0.08em] text-(--ap-muted) uppercase">History</h3>
          <ol className="relative m-0 list-none pl-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-0.5 before:bg-(--ap-line)">
            {timeline.map(([what, when], idx) => (
              <li key={idx} className="relative flex gap-3 py-1.5 text-[14px] before:absolute before:top-[11px] before:-left-5 before:size-2.5 before:rounded-full before:bg-(--ap-violet)">
                <span className="text-(--ap-ink)">{what}</span>
                {when ? <span className="text-(--ap-muted)">{when}</span> : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-(--ap-line) pt-4">
          {actions ? <div>{actions}</div> : null}
          <p className="m-0 text-[13px] text-(--ap-muted)">For security the link is shown only once, when it is created. If it was lost, create a new link; the old one stops working.</p>
        </div>
      </aside>
    </div>
  );
}
