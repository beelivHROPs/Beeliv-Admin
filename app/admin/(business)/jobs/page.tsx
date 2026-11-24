import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsHub } from "@/components/admin/hubs/JobsHub";
import { JobsSkeleton } from "@/components/admin/vacancies/VacanciesList";

export const metadata: Metadata = { title: "Jobs" };

export default function Page() {
  // The job list keeps its filters in the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<JobsSkeleton />}>
      <JobsHub />
    </Suspense>
  );
}
