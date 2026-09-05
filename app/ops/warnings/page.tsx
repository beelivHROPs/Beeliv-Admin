import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Warnings" };

export default function OpsWarningsPage() {
  return (
    <ComingSoonScreen
      title="Warnings"
      description="Beeliv-wide disciplinary/warning records (Stage 2 build)."
    />
  );
}
