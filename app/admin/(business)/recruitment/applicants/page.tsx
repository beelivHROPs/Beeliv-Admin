import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicantsList } from "@/components/admin/applicants/ApplicantsList";
import { ScopeGate } from "@/components/admin/ScopeNote";

export const metadata: Metadata = { title: "Applicants" };

/**
 * Applicants: its own page under the People dropdown (lead 2026-11-24). The list keeps its filters in the URL
 * (useSearchParams), which needs a Suspense boundary. Old /admin/people?view=applicants links still open the People hub.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="ap-shimmer h-[320px] rounded-2xl" role="status" aria-busy="true" aria-label="Loading applicants" />}>
      <ScopeGate>
        <ApplicantsList />
      </ScopeGate>
    </Suspense>
  );
}
