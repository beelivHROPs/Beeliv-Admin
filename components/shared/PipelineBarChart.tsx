"use client";

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

// Purple → gold sequence lifted straight from the app's own chart palette
// (app/globals.css --chart-1..4), not invented — gives the Ops "high-end
// data" pass a real brand-gradient reading across the bars instead of one
// flat color, while staying inside the existing token system.
const STAGE_COLORS = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)", "var(--chart-4)"];

const chartConfig = {
  count: { label: "Candidates" },
} satisfies ChartConfig;

/**
 * Horizontal bar chart for the Ops dashboard's Recruitment Pipeline widget —
 * replaces the earlier plain progress-bar list with a real recharts chart
 * (project-lead direction: "high-end data design" for HR/Ops). Real data
 * only: SAMPLE_RECRUITMENT_PIPELINE's own stage/count pairs, nothing
 * invented. Labeled bars (count shown directly, not hover-only) so the
 * numbers stay readable without depending on the tooltip.
 */
export function PipelineBarChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 28, bottom: 4, left: 4 }}
        barCategoryGap={14}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="stage"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={6} maxBarSize={22}>
          {data.map((entry, i) => (
            <Cell key={entry.stage} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
          ))}
          <LabelList dataKey="count" position="right" className="fill-foreground text-xs font-medium" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
