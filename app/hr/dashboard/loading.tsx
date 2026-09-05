import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/shared/Skeleton";
import { DashboardHeaderSkeleton, DashboardMetricsRowSkeleton } from "@/components/shared/DashboardLoadingShell";

/** Mirrors app/hr/dashboard/page.tsx: header, 4 metric tiles, then a
 *  warnings list beside Quick Actions + Onboarding Status. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <DashboardHeaderSkeleton />
      <DashboardMetricsRowSkeleton />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent>
            <Skeleton className="mb-3 h-3 w-40" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                style={{ marginBottom: i < 2 ? "0.75rem" : 0 }}
              >
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1.5 h-3 w-44" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <Skeleton className="mb-3 h-3 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="mt-2 h-9 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Skeleton className="mb-2 h-3 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
