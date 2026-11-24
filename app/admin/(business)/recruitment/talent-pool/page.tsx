import type { Metadata } from "next";
import { Suspense } from "react";
import { TalentPoolList } from "@/components/admin/talent-pool/TalentPoolList";
import { ScopeGate } from "@/components/admin/ScopeNote";

export const metadata: Metadata = { title: "Talent Pool" };

/**
 * Talent pool: its own page under the People dropdown (lead 2026-11-24). Not connected to real data yet, so a live
 * deployment shows Coming soon here (lib/admin/sample-routes.ts) and the menu hides it. Old /admin/people?view=pool
 * links still open the People hub.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="ap-shimmer h-[320px] rounded-2xl" role="status" aria-busy="true" aria-label="Loading talent pool" />}>
      <ScopeGate>
        <TalentPoolList />
      </ScopeGate>
    </Suspense>
  );
}
