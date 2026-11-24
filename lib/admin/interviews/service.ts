/**
 * InterviewsService: the single door the hooks use. Adds NO business rules.
 * Live deployments use the real adapter (server-decided mode, same flag as Team & Access and Workforce);
 * the sample fixture is preview-only.
 */
import type { InterviewsAdapter } from "./adapter";
import { mockInterviewsAdapter } from "./mock";
import { liveInterviewsAdapter } from "./live";
import { teamAccessMode } from "../team-access/mode";

/** True when the screens read and write REAL interviews. */
export const interviewsLive = (): boolean => teamAccessMode() === "live";
const pick = (): InterviewsAdapter => (interviewsLive() ? liveInterviewsAdapter : mockInterviewsAdapter);
const adapter: InterviewsAdapter = new Proxy({} as InterviewsAdapter, { get: (_t, k) => (pick() as unknown as Record<string | symbol, unknown>)[k] });

export const subscribeInterviews: InterviewsAdapter["subscribe"] = (l) => adapter.subscribe(l);
export const listInterviews: InterviewsAdapter["listInterviews"] = (q) => adapter.listInterviews(q);
export const getInterview: InterviewsAdapter["getInterview"] = (id) => adapter.getInterview(id);
export const checkConflicts: InterviewsAdapter["checkConflicts"] = (q) => adapter.checkConflicts(q);
export const scheduleInterview: InterviewsAdapter["scheduleInterview"] = (id, i) => adapter.scheduleInterview(id, i);
export const rescheduleInterview: InterviewsAdapter["rescheduleInterview"] = (id, i) => adapter.rescheduleInterview(id, i);
export const cancelInterview: InterviewsAdapter["cancelInterview"] = (id, i) => adapter.cancelInterview(id, i);
export const saveScorecard: InterviewsAdapter["saveScorecard"] = (id, i) => adapter.saveScorecard(id, i);
