import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Attendance" };

export default function OpsAttendancePage() {
  return (
    <ComingSoonScreen
      title="Attendance"
      description="Beeliv-wide attendance records (Stage 2 build)."
    />
  );
}
