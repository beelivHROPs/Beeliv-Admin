"use client";

import { useEffect, useState } from "react";
import { CancelButton, SheetFrame } from "@/components/admin/offers/Sheet";
import { getInvitationDetails } from "@/lib/admin/team-access/hooks";
import { teamAccessMode } from "@/lib/admin/team-access/mode";
import { invitationCreator, invitationDeliveryNote, invitationTiming } from "@/lib/admin/team-access/invitation-presentation";
import type { Invitation } from "@/lib/admin/team-access/types";
import { formatDate } from "@/lib/applicant/time";
import { DELIVERY_LABEL, INVITE_LABEL, KIND_LABEL } from "./meta";

export function InvitationDetailsSheet({ invitation, onClose }: { invitation: Invitation; onClose: () => void }) {
  const live = teamAccessMode() === "live";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; item: Invitation | null } | null>(null);
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    getInvitationDetails(invitation.id, invitation.revision).then(
      item => { if (!cancelled) setResult({ attempt, item }); },
      () => { if (!cancelled) setResult({ attempt, item: null }); },
    );
    return () => { cancelled = true; };
  }, [live, invitation.id, invitation.revision, attempt]);
  const current = result?.attempt === attempt ? result : null;
  const item = live && current?.item ? current.item : invitation;
  const loading = live && !current;
  const failed = live && current?.item === null;
  const expires = item.expiresAt && Number.isFinite(Date.parse(item.expiresAt)) ? formatDate(item.expiresAt) : "Unavailable";
  const fields = [
    ["Invitee", item.name], ["Email", item.email || (loading ? "Loading..." : "Unavailable")],
    ["Invitation type", KIND_LABEL[item.kind]], ["Role", item.roleLabel], ["Job title", item.jobTitle || "Not provided"],
    ["Assigned clients and outlets", item.scopeLabel], ["Creator", invitationCreator(item)],
    ["Invitation", INVITE_LABEL[item.status]], ["Date", invitationTiming(item)], ["Expires", expires],
    ["Delivery", DELIVERY_LABEL[item.delivery.status]], ["Delivery details", invitationDeliveryNote(item)],
    ...(item.reference ? [["Reference", item.reference]] : []),
  ];
  return <SheetFrame title="Invitation details" description="Account access and delivery details for this invitation." onClose={onClose}
    footer={<CancelButton onClick={onClose} label="Done" />}>
    {loading ? <p role="status" className="mt-3 text-sm text-(--ap-muted)">Checking current details...</p> : null}
    {failed ? <div role="alert" className="mt-3 text-sm text-(--ap-rose)"><p>We could not refresh this invitation. The saved list details are shown below. Reload Invitations if it has changed.</p><button type="button" className="ap-btn ap-btn-s mt-2" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : null}
    <dl className="mt-4 divide-y divide-(--ap-line)">{fields.map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs text-(--ap-muted)">{label}</dt><dd className="mt-1 break-words text-sm text-(--ap-ink)">{value}</dd></div>)}</dl>
  </SheetFrame>;
}
