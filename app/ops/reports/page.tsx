import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Reports" };

export default function OpsReportsPage() {
  return (
    <ComingSoonScreen
      title="Reports"
      description="Beeliv-wide operational reports and system activity (Stage 2 build)."
    />
  );
}
