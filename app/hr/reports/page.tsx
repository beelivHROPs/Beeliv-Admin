import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Reports" };

export default function HrReportsPage() {
  return (
    <ComingSoonScreen
      title="Reports"
      description="Outlet staff reports (Stage 2 build)."
    />
  );
}
