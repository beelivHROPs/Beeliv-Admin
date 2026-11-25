"use client";

/** Shared pieces of the invite sheets: a checkbox row and the result panel that shows the invitation link. */
import { teamAccessMode } from "@/lib/admin/team-access/mode";
import { useRef, useState, type ReactNode } from "react";
import { PrimaryButton } from "@/components/admin/offers/Sheet";
import { Disc } from "@/components/admin/overview/Disc";
import { Check, Exclaim } from "@/components/applicant/icons";
import { createAccessLink, sendInvitation } from "@/lib/admin/team-access/hooks";
import type { AccessLink, Invitation } from "@/lib/admin/team-access/types";

import { AccessLinkSheet } from "./AccessLinkSheet";
import { explainCaught } from "@/lib/shared/error-messages";

export function Checkbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-(--ap-line) px-3 py-2 text-[14px] text-(--ap-ink-2)">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 accent-(--ap-violet)" />
      <span className="min-w-0 break-words">{children}</span>
    </label>
  );
}

/**
 * After a record and its invitation are created: the invitation is NOT sent
 * automatically. Sending is an explicit action ("Send invitation"). No link is
 * put in a mailto: the raw link appears once after an explicit Create access link.
 * The embedded link view shares the parent dialog and keeps the token in memory only.
 */
export function InviteLinkResult({ inv: first, onClose }: { inv: Invitation; onClose: () => void }) {
  const liveMode = teamAccessMode() === "live";
  const [inv, setInv] = useState(first);
  const [link, setLink] = useState<AccessLink | null>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = liveMode ? inv.delivery.status === "queued" || inv.delivery.status === "sent" || inv.delivery.status === "copied" : inv.delivery.status !== "not-sent";
  async function send() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      setInv(await sendInvitation(inv.id, inv.revision));
    } catch (e) {
      setError(explainCaught(e, "We could not confirm sending. Check Invitations before trying again.", "invite"));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function makeLink() {
    if (working.current || !liveMode || inv.actions?.copyLink !== true) return;
    working.current = true; setBusy(true); setError(null);
    try {
      setLink(await createAccessLink(inv.id, inv.revision));
    } catch (e) {
      setError(explainCaught(e, "We could not confirm creating the link. Open Invitations to check this invitation before trying again.", "invite"));
    } finally { working.current = false; setBusy(false); }
  }
  if (link) return <AccessLinkSheet name={inv.name} link={link} onClose={onClose} embedded />;
  return (
    <div>
      <div className={`mt-4 flex items-start gap-3 rounded-xl p-3.5 ${sent ? "bg-(--ap-ok-bg)" : "bg-(--ap-warn-bg)"}`}>
        <Disc icon={sent ? Check : Exclaim} tone={sent ? "ok" : "pending"} />
        <p className="min-w-0 text-[14px] leading-snug text-(--ap-ink)">
          {sent ? (
            <>
              {liveMode ? <><b>{inv.delivery.status === "copied" ? "Access link created" : inv.delivery.status === "queued" ? "Invitation queued for delivery" : "Invitation sent"}</b> for {inv.name}{inv.email ? ` (${inv.email})` : ""}. Check Invitations for the latest status.</> : <><b>Invitation sent (recorded)</b> for {inv.name} ({inv.email}). Email delivery is connected later, so nothing was emailed. You can resend or revoke it from Invitations.</>}
            </>
          ) : (
            <>
              <b>Record created. The invitation has not been sent.</b> Choose Send invitation or Create access link below. Nothing is sent automatically.
            </>
          )}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 min-[560px]:flex-row min-[560px]:flex-wrap">
        {!sent ? (
          <button type="button" disabled={busy || (liveMode && inv.actions?.send !== true)} onClick={send} className="ap-btn ap-btn-p h-12 text-[15px] font-semibold text-white! min-[560px]:h-11">
            {busy ? "Working..." : "Send invitation"}
          </button>
        ) : null}
        {liveMode && !sent && inv.actions?.copyLink === true ? <button type="button" disabled={busy} onClick={() => void makeLink()} className="ap-btn ap-btn-s h-12 min-[560px]:h-11">{busy ? "Working..." : "Create access link"}</button> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-(--ap-rose)">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-(--ap-muted)" role="status">
          An access link is shown once. Share it only with the intended person.
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <PrimaryButton onClick={onClose} disabled={busy}>{sent ? "Done" : "Close without sending"}</PrimaryButton>
      </div>
    </div>
  );
}
