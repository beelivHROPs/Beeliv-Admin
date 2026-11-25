/**
 * Which Admin pages read REAL data in a live deployment, and which still show built-in sample data.
 * Pure, no imports, so it can be unit-tested. Used by components/admin/SampleDataBanner.tsx.
 *
 * Lead decision 2026-11-13: sample pages stay visible on the live site, each clearly labelled
 * "Preview. Sample data, nothing here is saved." Anything NOT listed as real counts as sample, so a
 * newly added page fails safe (labelled) until its live adapter exists. When a module goes live, add
 * its routes here.
 */
const REAL_PREFIXES = [
  "/admin/people", // Live People: real Applicants (submitted applications) and the real Staff directory only.
  "/admin/recruitment/applicants", // Applicant 360 on a real submitted application (lib/admin/applicants/live.ts)
  "/admin/workforce/scheduling", // weekly rosters (workforce-shifts-attendance.sql, lib/admin/workforce/live.ts)
  "/admin/workforce/attendance", // check-ins against published shifts
  "/admin/workforce/leave", // leave requests and decisions (workforce-leave.sql)
  "/admin/workforce/warnings", // warnings and records (day2-warnings-requests.sql, part A)
  "/admin/staff", // directory, assignments, documents (org records + staff documentation, live)
  "/admin/team-access", // team and access, invitations (auth backend, live)
  "/admin/ops/clients", // Operations clients and outlets (org records, live)
  "/admin/ops/staff", // Operations staff placements (org records, live)
  "/admin/ops/assignments", // Operations placements by client (org records, live)
  "/admin/inbox", // client staff requests only (day2-warnings-requests.sql, lib/admin/inbox/live.ts); other sources stay empty
] as const;

/** Home pages are replaced by a real "start here" page in a live deployment, so they need no banner. */
const HOMES = ["/admin", "/admin/ops"] as const;

const clean = (p: string): string => p.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
const under = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`);

/** `interviewsLive`: the Interviews screens read real interviews (lib/admin/interviews/live.ts, recruitment-interviews-phase2.sql). */
export function isSampleAdminRoute(pathname: string, vacanciesLive = false, interviewsLive = false): boolean {
  const path = clean(pathname);
  if (!under(path, "/admin")) return false;
  if ((HOMES as readonly string[]).includes(path)) return false;
  if (REAL_PREFIXES.some((p) => under(path, p))) return false;
  // Clients and outlets are live; client REQUESTS are not yet.
  if (under(path, "/admin/clients") && !under(path, "/admin/clients/requests")) return false;
  // The Jobs page (/admin/jobs) is the vacancy list: real once the vacancies backend is on, Coming soon before that.
  if (vacanciesLive && (under(path, "/admin/recruitment/vacancies") || under(path, "/admin/jobs"))) return false;
  // Interviews: real (or their approved empty state) once the live adapter is in use, Coming soon otherwise.
  if (interviewsLive && under(path, "/admin/recruitment/interviews")) return false;
  return true;
}
