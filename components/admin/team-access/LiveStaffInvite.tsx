"use client";

import { useRef, useState } from "react";
import { StaffSheet } from "@/components/admin/org-records/OrgSheets";
import { CancelButton, PrimaryButton, SheetFrame } from "@/components/admin/offers/Sheet";
import { createStaff, type StaffFields } from "@/lib/admin/org-records/writes";
import { orgErrorMessage } from "@/lib/admin/org-records/transport";
import { orgRecordsWritesAvailable } from "@/lib/admin/org-records/mode";
import { useCan } from "@/lib/admin/role-access";
import { inviteUser } from "@/lib/admin/team-access/hooks";
import { staffInvitationFlow } from "@/lib/admin/team-access/staff-invitation-flow";
import type { Invitation, InvitePrefill } from "@/lib/admin/team-access/types";
import { ExistingStaffInvite } from "./ExistingStaffInvite";
import { InviteLinkResult } from "./InviteParts";

export function LiveStaffInvite({ prefill, onClose, onDone }: { prefill?: InvitePrefill; onClose: () => void; onDone?: (inv: Invitation) => void }) {
  const canCreate = useCan("staff.create") && orgRecordsWritesAvailable();
  const [existing, setExisting] = useState(!!prefill?.personId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<StaffFields | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [flow] = useState(() => staffInvitationFlow({ create: createStaff, invite: inviteUser }));
  const working = useRef(false);

  async function submit(fields: StaffFields) {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError(null);
    try {
      const result = await flow.run(fields);
      setInvitation(result); onDone?.(result);
    } catch (failure) {
      const record = flow.saved();
      if (record) {
        setSaved(record.fields);
        setError("The staff record is saved. We could not confirm the invitation. Check Invitations, or retry the same invitation here; the staff record will not be created again.");
      } else {
        setError(orgErrorMessage(failure, "We could not confirm saving. Check Staff Directory before starting another record, or retry the same details here."));
      }
    } finally { working.current = false; setBusy(false); }
  }

  if (invitation) return <SheetFrame title="Staff invitation" onClose={onClose} footer={null}><InviteLinkResult inv={invitation} onClose={onClose} /></SheetFrame>;
  if (saved) return <SheetFrame title="Finish staff invitation" description={`The staff record for ${saved.fullName} is saved. Only the invitation remains.`} busy={busy} onClose={onClose}
    footer={<><CancelButton onClick={onClose} disabled={busy} /><PrimaryButton onClick={() => void submit(saved)} disabled={busy}>{busy ? "Working..." : "Retry invitation"}</PrimaryButton></>}>
    {error ? <p role="alert" className="mt-4 text-sm text-(--ap-rose)">{error}</p> : null}
  </SheetFrame>;
  if (existing || !canCreate) return <ExistingStaffInvite prefill={prefill} onClose={onClose} onDone={onDone} />;
  return <StaffSheet title="Invite staff" submitLabel={busy ? "Working..." : "Create invitation"}
    description="Enter the person's details and where they work. Next, send their invitation by email or create an access link. They set up their own account."
    busy={busy} error={error} onCancel={onClose} onSubmit={(fields) => void submit(fields)} onUseExisting={() => setExisting(true)} />;
}
