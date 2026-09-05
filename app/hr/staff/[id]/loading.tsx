import { Skeleton } from "@/components/shared/Skeleton";

/** Mirrors app/hr/staff/[id]/page.tsx: back link, PageHeading (h1
 *  text-xl, mb-6, mt-1 description), a 2-column Profile/Documentation
 *  card grid (components/shared/Card.tsx), and the disabled "Issue
 *  Warning" button. */
export default function Loading() {
  return (
    <div>
      <Skeleton className="h-3.5 w-28" />

      <div className="mt-3 mb-6">
        <Skeleton className="h-6 w-48 max-w-full" />
        <Skeleton className="mt-1 h-3.5 w-32" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="mb-2 h-3.5 w-14" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-0.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="mb-2 h-3.5 w-28" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  );
}
