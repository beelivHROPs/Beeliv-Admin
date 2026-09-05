import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Schedules" };

export default function HrSchedulesPage() {
  return (
    <ComingSoonScreen
      title="Schedules"
      description="Outlet staff schedules (Stage 2 build)."
    />
  );
}
