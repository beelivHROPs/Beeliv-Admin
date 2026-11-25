"use client";

import { useEffect, useId, useState } from "react";
import { CancelButton, FIELD_LABEL, PrimaryButton, SheetFrame } from "@/components/admin/offers/Sheet";
import { SelectMenu } from "@/components/applicant/SelectMenu";
import { orgCall } from "@/lib/admin/org-records/transport";
import { inviteUser } from "@/lib/admin/team-access/hooks";
import type { Invitation, InvitePrefill } from "@/lib/admin/team-access/types";
import { InviteLinkResult } from "./InviteParts";
import { explainCaught } from "@/lib/shared/error-messages";

type StaffRow = { id: string; name: string; reference: string };
type StaffDetail = StaffRow & {
  email: string; onboardingOrigin: string;
  current: { clientId: string; outletId: string; client: string; outlet: string } | null;
};

/** Live invites use an existing protected record. This sheet never creates a person or a placement. */
export function ExistingStaffInvite({ prefill, onClose, onDone }: { prefill?: InvitePrefill; onClose: () => void; onDone?: (inv: Invitation) => void }) {
  const uid = useId();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1, attempt: 0 });
  const [records, setRecords] = useState<{ items: StaffRow[]; total: number } | null>(null);
  const [personId, setPersonId] = useState(prefill?.personId ?? "");
  const [person, setPerson] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  useEffect(() => {
    let cancelled = false;
    orgCall<{ items: StaffRow[]; total: number }>("staff-list", { search: query.search, page: query.page, pageSize: 50 }).then(
      (value) => { if (!cancelled) { setRecords(value); setLoading(false); } },
      () => { if (!cancelled) { setError("We could not load Staff records. Try searching again."); setLoading(false); } },
    );
    return () => { cancelled = true; };
  }, [query]);
  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    orgCall<{ item: StaffDetail } | StaffDetail>("staff-get", { staffId: personId }).then(
      (value) => { if (!cancelled) { setPerson("item" in value ? value.item : value); setChoosing(false); } },
      () => { if (!cancelled) { setError("We could not load that Staff record. Choose it again."); setChoosing(false); } },
    );
    return () => { cancelled = true; };
  }, [personId]);
  const ready = person?.id === personId && person.onboardingOrigin === "legacy" && !!person.email && !!person.current && !busy && !choosing;
  async function create() {
    if (!ready || !person?.current) return;
    setBusy(true); setError(null);
    try {
      const inv = await inviteUser({ kind: "staff", personId: person.id, name: person.name, email: person.email,
        clientId: person.current.clientId, outletIds: [person.current.outletId], allClients: false, scopeClientIds: [], expiresInDays: 7 });
      setInvitation(inv); onDone?.(inv);
    } catch (e) {
      setError(explainCaught(e, "We could not confirm the invitation. Check Invitations before trying again.", "invite"));
    } finally { setBusy(false); }
  }
  return <SheetFrame title="Invite existing staff" description="Choose an existing Staff record. The invitation uses its saved email and current placement." onClose={onClose} busy={busy} width={560} footer={invitation ? null : <><CancelButton onClick={onClose} disabled={busy} /><PrimaryButton onClick={create} disabled={!ready}>{busy ? "Working..." : "Create invitation"}</PrimaryButton></>}>
    {invitation ? <InviteLinkResult inv={invitation} onClose={onClose} /> : <>
      <form className="mt-4 flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(null); setRecords(null); setQuery({ search: search.trim(), page: 1, attempt: query.attempt + 1 }); }}>
        <div className="min-w-0 flex-1"><label htmlFor={uid} className={FIELD_LABEL}>Search Staff Directory</label><input id={uid} className="ap-input mt-1.5" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} /></div>
        <button className="ap-btn ap-btn-s h-11" type="submit" disabled={loading}>Search</button>
      </form>
      {loading ? <p role="status" className="mt-4">Loading Staff records...</p> : <div className="mt-4">
        <SelectMenu label="Staff record" value={personId} placeholder="Choose a Staff record" options={(records?.items ?? []).map((item) => ({ value: item.id, label: item.name + " · " + item.reference }))} onChange={(id) => { setPerson(null); setChoosing(true); setError(null); setPersonId(id); }} />
        {records && records.items.length === 0 ? <p className="mt-2 text-sm text-(--ap-muted)">No matching Staff records. Add a Staff record in Staff Directory first.</p> : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" className="ap-btn ap-btn-s ap-btn-sm" disabled={query.page === 1} onClick={() => { setLoading(true); setRecords(null); setQuery({ ...query, page: query.page - 1 }); }}>Previous</button>
          <span className="text-sm text-(--ap-muted)">Page {query.page}</span>
          <button type="button" className="ap-btn ap-btn-s ap-btn-sm" disabled={!records || query.page * 50 >= records.total} onClick={() => { setLoading(true); setRecords(null); setQuery({ ...query, page: query.page + 1 }); }}>Next</button>
        </div>
      </div>}
      {choosing ? <p role="status" className="mt-4">Loading selected record...</p> : null}
      {person?.id === personId ? <div className="ap-card mt-4 rounded-xl p-4"><p className="font-semibold">{person.name}</p><p className="mt-1 text-sm">{person.email}</p><p className="mt-1 text-sm text-(--ap-muted)">{person.current ? person.current.client + " · " + person.current.outlet : "This person needs a current placement before a Staff invitation can be created."}</p>{person.onboardingOrigin !== "legacy" ? <p className="mt-2 text-sm">This invitation path is for existing legacy Staff records.</p> : null}</div> : null}
      <p className="mt-4 text-sm text-(--ap-muted)">Expiry is set automatically. Nothing is sent until you choose email delivery or create an access link.</p>
      {error ? <p role="alert" className="mt-3 text-sm text-(--ap-rose)">{error}</p> : null}
    </>}
  </SheetFrame>;
}


