import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Leave" };

export default function OpsLeavePage() {
  return (
    <ComingSoonScreen
      title="Leave"
      description="Beeliv-wide leave records (Stage 2 build)."
    />
  );
}
