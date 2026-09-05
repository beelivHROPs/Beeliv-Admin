import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Leave" };

export default function HrLeavePage() {
  return (
    <ComingSoonScreen
      title="Leave"
      description="Outlet leave tracking (Stage 2 build)."
    />
  );
}
