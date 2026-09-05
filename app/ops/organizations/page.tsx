import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Client Organizations" };

export default function OpsOrganizationsPage() {
  return (
    <ComingSoonScreen
      title="Client Organizations"
      description="All client organizations and outlets (Stage 2 build)."
    />
  );
}
