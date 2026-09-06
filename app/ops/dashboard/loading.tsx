import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/shared/Skeleton";
import { DashboardHeroRowSkeleton, DashboardMetricsRowSkeleton } from "@/components/shared/DashboardLoadingShell";

/** Mirrors the current app/ops/dashboard/page.tsx: hero row (HeroStatCard +
 *  donut), 4 metric tiles, then a recruitment-pipeline bar chart beside
 *  Quick Actions + Operational Reports + Staff Distribution by Outlet.
 *  Previously stale — showed no hero/ring placeholder and no Staff
 *  Distribution card at all. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <DashboardHeroRowSkeleton />
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
          <Card>
            <CardContent>
              <Skeleton className="mb-3 h-3 w-40" />
              <Skeleton className="h-3 w-full rounded-full" />
              {[0, 1].map((i) => (
                <div key={i} className="mt-2.5 flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
