import { Skeleton } from "@/components/shared/Skeleton";

/** Mirrors app/hr/staff/page.tsx: mobile card list below sm, table above —
 *  same responsive split as the real page, not a generic list. */
export default function Loading() {
  return (
    <div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />

      <div className="mt-4 flex flex-col gap-3 sm:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-24" />
            <div className="mt-2.5 flex gap-1.5">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-lg border border-border bg-card sm:block">
        <div className="border-b border-border bg-muted/50 px-4 py-2">
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
