import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Schedules" };

export default function OpsSchedulesPage() {
  return (
    <ComingSoonScreen
      title="Schedules"
      description="Beeliv-wide staff schedules (Stage 2 build)."
    />
  );
}
