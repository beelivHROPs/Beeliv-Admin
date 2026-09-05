import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Staff" };

export default function OpsStaffPage() {
  return (
    <ComingSoonScreen
      title="Staff"
      description="Beeliv-wide staff directory, assigned and unassigned (Stage 2 build)."
    />
  );
}
