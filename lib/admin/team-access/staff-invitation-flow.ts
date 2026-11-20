import type { StaffFields } from "../org-records/writes";
import type { StaffCreateReceipt } from "../../server/org-records/types";
import type { Invitation, InviteInput } from "./types";

type SavedStaff = { receipt: StaffCreateReceipt; fields: StaffFields };
type Dependencies = { create: (fields: StaffFields) => Promise<StaffCreateReceipt>; invite: (input: InviteInput) => Promise<Invitation> };

/** Two guarded writes, never a fictitious transaction. Retain the receipt if the second write fails. */
export function staffInvitationFlow(deps: Dependencies) {
  let saved: SavedStaff | null = null;
  let completed: Invitation | null = null;
  let pending: Promise<Invitation> | null = null;
  return {
    saved: () => saved,
    run(fields: StaffFields): Promise<Invitation> {
      if (completed) return Promise.resolve(completed);
      if (pending) return pending;
      const snapshot: StaffFields = { ...fields, placement: fields.placement ? { ...fields.placement } : null };
      if (!saved && !snapshot.placement) return Promise.reject(new Error("placement_required"));
      pending = (async () => {
        if (!saved) saved = { receipt: await deps.create(snapshot), fields: snapshot };
        const { receipt, fields: person } = saved;
        const placement = person.placement!;
        completed = await deps.invite({ kind: "staff", personId: receipt.staffId, name: person.fullName, email: person.email,
          clientId: placement.clientId, outletIds: [placement.outletId], allClients: false, scopeClientIds: [], expiresInDays: 7 });
        return completed;
      })().finally(() => { pending = null; });
      return pending;
    },
  };
}
