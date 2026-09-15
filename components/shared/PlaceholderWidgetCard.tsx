import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Widget-level version of ComingSoonScreen — for a single card slot inside
 * an otherwise-real dashboard, not a whole page. Used when a reference
 * design's widget needs data Beeliv doesn't have yet (a real logged-in
 * user's per-person stats, historical week-by-week trend numbers, etc.):
 * project-lead direction was "put the placeholders and we'll do the
 * functionality in stage 2" rather than fabricating numbers to fill the
 * shape. Dashed border + muted fill + an explicit "Coming in Stage 2" pill
 * make it unambiguous this card shows no real data, unlike every other
 * (data-backed) card on the same dashboard.
 */
export function PlaceholderWidgetCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-xl border-2 border-dashed border-border bg-muted/30 shadow-none ring-0 sm:rounded-2xl",
        className
      )}
    >
      <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
        <span className="mt-1 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Coming in Stage 2
        </span>
      </CardContent>
    </Card>
  );
}
