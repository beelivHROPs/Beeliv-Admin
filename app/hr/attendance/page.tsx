import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Attendance" };

export default function HrAttendancePage() {
  return (
    <ComingSoonScreen
      title="Attendance"
      description="Outlet attendance monitoring (Stage 2 build)."
    />
  );
}
