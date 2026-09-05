import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Warnings" };

export default function HrWarningsPage() {
  return (
    <ComingSoonScreen
      title="Warnings"
      description="Disciplinary/warning records for this outlet (Stage 2 build)."
    />
  );
}
