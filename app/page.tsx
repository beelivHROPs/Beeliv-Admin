import { redirect } from "next/navigation";

/**
 * Beeliv-Admin root ("admin.beeliv.co/") — this app serves two roles
 * (Assigned HR, Head of Operations) with no public/unauthenticated content
 * of its own. Real users only ever arrive here already knowing which role
 * they are, via the shared login on beeliv.co redirecting them straight to
 * "/hr/dashboard" or "/ops/dashboard" once real Supabase Auth + a `profiles`
 * table exist (Stage 2 — see docs/STAGE-1-MASTER-PLAN.md §15's recommended
 * first implementation task in the main repo).
 *
 * Structural-only placeholder for the bare root itself (e.g. someone
 * bookmarks "admin.beeliv.co" directly): redirects to "/hr/dashboard" as a
 * reasonable default, not a real role-detection decision — there is no
 * auth here yet to detect a role from.
 */
export default function AdminRootPage() {
  redirect("/hr/dashboard");
}
