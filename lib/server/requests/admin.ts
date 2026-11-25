import "server-only";
import { adminClient, sessionClient } from "../auth/session";
import { AuthFailure } from "../auth/service";
import { limitAuth } from "../auth/rate";
import { parseStaffRequestUpdate, projectAdminRequests } from "../client-workspace/requests";

/**
 * Admin side of client staff requests (docs/contracts/day2-warnings-requests.sql, part B): the Inbox list and the status
 * change. Admin session with AAL2 (same proof as the workforce actions). The database re-checks the permission
 * (request.read / request.manage), the HR officer's client scope, the revision and the transition.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);

async function actor() {
  const client = await sessionClient("admin");
  const { data: identity, error: identityError } = await client.auth.getUser();
  const { data: proof, error: proofError } = await client.auth.getClaims();
  const user = identity.user, claims = proof?.claims;
  if (identityError || proofError || !user?.email_confirmed_at || claims?.sub !== user.id || typeof claims.session_id !== "string" || !UUID.test(claims.session_id)) throw new AuthFailure("unauthenticated", 401);
  if (claims.aal !== "aal2") throw new AuthFailure("mfa_required", 403);
  await limitAuth("admin", "org_read", `admin-requests:${user.id}`);
  return { uid: user.id, sessionId: claims.session_id as string };
}

async function call(fn: string, args: Rec) {
  const who = await actor();
  const { data, error } = await adminClient("admin").rpc(fn, { p_actor_uid: who.uid, p_session_id: who.sessionId, ...args });
  if (error) throw new AuthFailure("unavailable", 503);
  const d = rec(data);
  if (d?.ok === false) {
    const reason = typeof d.reason === "string" ? d.reason : "";
    if (reason === "no_access") throw new AuthFailure("no_access", 403);
    if (reason === "rate_limited") throw new AuthFailure("rate_limited", 429);
    // Plain refusals the drawer explains (stale, invalid_transition, invalid_request).
    return { ok: false as const, reason: ["stale", "invalid_transition", "invalid_request"].includes(reason) ? reason : "unavailable", ...(Number.isSafeInteger(d.revision) ? { revision: d.revision } : {}) };
  }
  if (d?.ok !== true) throw new AuthFailure("unavailable", 503);
  return d;
}

export async function requestsAdmin(action: string, input: Rec) {
  switch (action) {
    case "list": {
      if (Object.keys(input).length) throw new AuthFailure("invalid_request", 400);
      const d = await call("client_staff_request_admin_list", {});
      if (d.ok !== true) return d;
      return { ok: true, canManage: d.canManage === true, items: projectAdminRequests(d.items) };
    }
    case "update": {
      const u = parseStaffRequestUpdate(input);
      if (!u) throw new AuthFailure("invalid_request", 400);
      const d = await call("client_staff_request_admin_update", { p_request_id: u.requestId, p_expected_revision: u.expectedRevision, p_status: u.status, p_message: u.message });
      if (d.ok !== true) return d;
      return { ok: true, revision: Number.isSafeInteger(d.revision) ? d.revision : null };
    }
    default: throw new AuthFailure("invalid_request", 404);
  }
}
