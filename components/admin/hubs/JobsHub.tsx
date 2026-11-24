"use client";

/**
 * Jobs page (/admin/jobs): the lead-approved Jobs board v4 (2026-11-24). The page is the
 * job list itself (components/admin/vacancies/VacanciesList.tsx: title, New job, search
 * bar, quick status chips, photo-card grid or table). The old "Hiring steps" tile row is
 * gone: those pages now live in the sidebar's Recruitment dropdown (components/admin/nav.ts)
 * and, on phones, in the More sheet.
 */
import { PageHeading } from "@/components/applicant/primitives";
import { ScopeEmpty } from "@/components/admin/ScopeNote";
import { VacanciesList } from "@/components/admin/vacancies/VacanciesList";
import { useAdminScope } from "@/lib/admin/scope";

export function JobsHub() {
  const scope = useAdminScope();
  // An HR officer with no assigned client: the page title plus the approved empty-scope state.
  if (scope.none) {
    return (
      <div>
        <PageHeading title="Jobs" />
        <ScopeEmpty />
      </div>
    );
  }
  return <VacanciesList />;
}
