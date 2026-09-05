import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/shared/Skeleton";
import { DashboardHeaderSkeleton, DashboardMetricsRowSkeleton } from "@/components/shared/DashboardLoadingShell";

/** Mirrors app/ops/dashboard/page.tsx: header, 4 metric tiles, then a
 *  recruitment-pipeline progress-bar list beside Quick Actions + Reports. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <DashboardHeaderSkeleton />
      <DashboardMetricsRowSkeleton />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent>
            <Skeleton className="mb-3 h-3 w-32" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={i < 3 ? "mb-3" : ""}>
                <div className="mb-1 flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-6" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
            <Skeleton className="mt-4 h-9 w-48 rounded-lg" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <Skeleton className="mb-2.5 h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="mt-2 h-9 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Skeleton className="mb-2.5 h-3 w-32" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-3 w-36" />
              <Skeleton className="mt-2 h-3 w-24" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
