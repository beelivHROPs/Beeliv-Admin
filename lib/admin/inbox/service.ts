/** The single door the hooks use. Delegates to the active adapter and adds NO business rules. */
import type { InboxAdapter } from "./adapter";
import { mockInboxAdapter } from "./mock";
import { liveInboxAdapter } from "./live";
import { teamAccessMode } from "../team-access/mode";

/** Live deployments use the real adapter (client staff requests only; server-decided mode, same flag as Team & Access); sample data is preview-only. */
const pick = (): InboxAdapter => (teamAccessMode() === "live" ? liveInboxAdapter : mockInboxAdapter);
const adapter: InboxAdapter = new Proxy({} as InboxAdapter, { get: (_t, k) => (pick() as unknown as Record<string | symbol, unknown>)[k] });

export const subscribeInbox: InboxAdapter["subscribe"] = (l) => adapter.subscribe(l);
export const getList = () => adapter.getList();
export const getCase = (id: string) => adapter.getCase(id);
export const reply = (id: string, body: string) => adapter.reply(id, body);
export const addNote = (id: string, body: string) => adapter.addNote(id, body);
export const assign = (id: string, assigneeId: string | null) => adapter.assign(id, assigneeId);
export const setStatus: InboxAdapter["setStatus"] = (id, s) => adapter.setStatus(id, s);
export const escalate = (id: string) => adapter.escalate(id);
export const markRead = (id: string) => adapter.markRead(id);
export const retryDelivery = (caseId: string, messageId: string) => adapter.retryDelivery(caseId, messageId);
export const checkDelivery = (caseId: string, messageId: string) => adapter.checkDelivery(caseId, messageId);
export const listNeedsHome = () => adapter.listNeedsHome();
export const searchCasesForPicker = (q: string) => adapter.searchCasesForPicker(q);
export const assignNeedsHome = (itemId: string, caseId: string) => adapter.assignNeedsHome(itemId, caseId);
export const dismissNeedsHome = (itemId: string) => adapter.dismissNeedsHome(itemId);
export const updateWorkforceRequest: InboxAdapter["updateWorkforceRequest"] = (id, s, m) => adapter.updateWorkforceRequest(id, s, m);
