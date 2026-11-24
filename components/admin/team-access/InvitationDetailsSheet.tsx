"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clock3 as Clock, Mail, X } from "@/components/applicant/icons";
import { getInvitationDetails } from "@/lib/admin/team-access/hooks";
import { teamAccessMode } from "@/lib/admin/team-access/mode";
import { invitationCreator, invitationDeliveryNote, invitationTiming } from "@/lib/admin/team-access/invitation-presentation";
import type { Invitation, InvitationStatus } from "@/lib/admin/team-access/types";
import { formatDate } from "@/lib/applicant/time";
import { DELIVERY_LABEL, INVITE_LABEL, KIND_LABEL } from "./meta";

/**
 * Invitation details in the SAME approved side panel as Inbox "Case details" (components/admin/inbox/InboxBody.tsx +
 * CaseDetails.tsx): 380px right drawer (bottom sheet on phones), "Invitation details" header with close, uppercase
 * field labels, activity history with icon circles, actions at the bottom. The link itself is never shown again.
 */
const DOT: Record<InvitationStatus, string> = { pending: "#e3b341", accepted: "#3fb27f", expired: "#9a8a92", revoked: "#c4566f" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[13px] font-bold tracking-wide text-(--ap-muted) uppercase">{label}</div>
      <div className="text-[15px] wrap-anywhere">{children}</div>
    </div>
  );
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
  const created = item.invitedAt && Number.isFinite(Date.parse(item.invitedAt)) ? formatDate(item.invitedAt) : "";
  const history: { icon: typeof Clock; text: string; when: string }[] = [
    ...(item.status !== "pending" ? [{ icon: Clock, text: INVITE_LABEL[item.status], when: invitationTiming(item) }] : []),
    ...(item.resendCount ? [{ icon: Mail, text: `Sent again ${item.resendCount}×`, when: "" }] : []),
    { icon: Mail, text: "Invitation created", when: [invitationCreator(item).replace(/^Created by /, ""), created].filter(Boolean).join(" - ") },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Invitation details">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-y-0 right-0 flex w-[min(380px,100vw)] flex-col bg-white shadow-2xl max-[719px]:inset-x-0 max-[719px]:top-auto max-[719px]:max-h-[85dvh] max-[719px]:w-full max-[719px]:rounded-t-2xl max-[719px]:pb-[env(safe-area-inset-bottom,0px)]">
        <span className="mx-auto mt-2 hidden h-1 w-10 rounded-full bg-(--ap-line) max-[719px]:block" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-(--ap-line) px-4 py-3">
          <h2 className="m-0 text-[17px] font-extrabold">Invitation details</h2>
          <button type="button" autoFocus onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-(--ap-line-2)" aria-label="Close details">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4">
            {loading ? <p role="status" className="m-0 text-sm text-(--ap-muted)">Checking current details...</p> : null}
            {failed ? (
              <div role="alert" className="text-sm text-(--ap-rose)">
                <p className="m-0">We could not refresh this invitation. The saved details are shown.</p>
                <button type="button" className="ap-btn ap-btn-s ap-btn-sm mt-2" onClick={() => setAttempt((v) => v + 1)}>Try again</button>
              </div>
            ) : null}
            {item.reference ? (
              <Field label="Reference"><span className="font-mono text-sm font-semibold">{item.reference}</span></Field>
            ) : null}
            <Field label="Invitee">
              <b className="block">{who}</b>
              {item.email && item.email !== who ? <span className="block text-(--ap-muted)">{item.email}</span> : null}
            </Field>
            <Field label="Type">{KIND_LABEL[item.kind]}{item.kind === "internal" && item.roleLabel ? ` - ${item.roleLabel}${item.jobTitle ? ` (${item.jobTitle})` : ""}` : ""}</Field>
            <Field label="Access">{item.scopeLabel}</Field>
            <Field label="Status">
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: DOT[item.status] }} />{INVITE_LABEL[item.status]}</span>
            </Field>
            <Field label="Link expires">{expiry}</Field>
            <Field label="Delivery">
              {DELIVERY_LABEL[item.delivery.status]}
              {invitationDeliveryNote(item) ? <span className="block text-[13px] text-(--ap-muted)">{invitationDeliveryNote(item)}</span> : null}
            </Field>
            {actions ? (
              <Field label="Actions">
                <div>{actions}</div>
                <p className="mt-1.5 text-[13px] text-(--ap-muted)">For security the link is shown only once. If it was lost, create a new link; the old one stops working.</p>
              </Field>
            ) : null}
            <section aria-labelledby="invitation-activity">
              <h3 id="invitation-activity" className="mb-2 text-[13px] font-bold tracking-wide text-(--ap-muted) uppercase">Activity history</h3>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {history.map((h, idx) => (
                  <li key={idx} className="flex gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-(--ap-line-2) text-(--ap-muted)">
                      <h.icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-sm wrap-anywhere">
                      {h.text}
                      {h.when ? <span className="block text-[13px] text-(--ap-muted)">{h.when}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
