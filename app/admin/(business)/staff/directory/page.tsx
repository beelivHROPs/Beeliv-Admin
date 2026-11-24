import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffDirectory } from "@/components/admin/staff/StaffDirectory";
import { ScopeGate } from "@/components/admin/ScopeNote";

export const metadata: Metadata = { title: "Staff Directory" };

/** Staff directory: its own page under the People dropdown (lead 2026-11-24). Old /admin/people?view=staff links still open the hub. */
export default function Page() {
  return (
    <Suspense fallback={<div className="ap-shimmer h-[320px] rounded-2xl" role="status" aria-busy="true" aria-label="Loading staff" />}>
      <ScopeGate>
        <StaffDirectory />
      </ScopeGate>
    </Suspense>
  );
}
