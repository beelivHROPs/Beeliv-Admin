import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "SOP Library" };

export default function OpsSopsPage() {
  return (
    <ComingSoonScreen
      title="SOP Library"
      description="Beeliv-wide SOP library management (Stage 2 build)."
    />
  );
}
