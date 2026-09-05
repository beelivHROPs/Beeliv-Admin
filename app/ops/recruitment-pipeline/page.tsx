import type { Metadata } from "next";
import { ComingSoonScreen } from "@/components/shared/ComingSoonScreen";

export const metadata: Metadata = { title: "Recruitment Pipeline" };

export default function OpsRecruitmentPipelinePage() {
  return (
    <ComingSoonScreen
      title="Recruitment Pipeline"
      description="Applicant/recruitment status across all outlets. Recruitment decision logic is explicitly out of scope for this implementation slice (Stage 2 build, pending Beeliv authority decisions)."
    />
  );
}
