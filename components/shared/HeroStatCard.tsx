import { DASHBOARD_TONE_BASE } from "@/lib/dashboard-accent";
import { cn } from "@/lib/utils";

/**
 * Bold gradient "hero stat" card — project-lead reference: the Mintora
 * dashboard's "Total Net Value" card (solid violet gradient, big white
 * number, small pill badge). This is the dashboard's one strong gradient
 * moment (design-system.md §3 "one gradient per screen" restraint) — it
 * replaces the previous flat .bg-brand-wash welcome header rather than
 * sitting alongside it.
 */
export function HeroStatCard({
  eyebrow,
  title,
  value,
  valueLabel,
  caption,
  badge,
  tone = "purple",
  className,
}: {
  eyebrow: React.ReactNode;
  title: string;
  value: React.ReactNode;
  valueLabel: string;
  caption?: React.ReactNode;
  badge?: React.ReactNode;
  /** Matches the dashboard's own AppShell navTone — this now rolled out to
   *  Ops (tone="purple") too, alongside HR (tone="gold"). */
  tone?: "purple" | "gold" | "lavender" | "slate";
  /** Extra classes, e.g. a softer radius on one dashboard without
   *  reshaping this card for every dashboard that uses it. */
  className?: string;
}) {
  const base = DASHBOARD_TONE_BASE[tone];
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl px-5 py-5 text-white sm:px-6 sm:py-6", className)}
      style={{
        // Clean single-hue gradient (light -> dark) built from the
        // dashboard's own tone token. Blending --gold and --primary via
        // color-mix in equal-ish parts desaturates into a muddy mauve
        // ("color doesn't match" feedback), which is why --tone-gold
        // (globals.css) exists as a single pre-mixed base instead of
        // remixing gold into every gradient stop here.
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${base} 45%, white 55%) 0%, ${base} 100%)`,
      }}
    >
      {/* Faint decorative circle — gold-rimmed everywhere except Client
          (slate), which gets a light-purple rim instead: a small brand
          touch (the logo's hand color) without giving this dashboard the
          same gold accent HR already owns. Same quiet motif as the
          homepage hero's blobs either way. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5 ${
          tone === "slate" ? "border border-[color:var(--chart-1)]/40" : "border border-[color:var(--gold)]/40"
        }`}
      />
      <div className="relative">
        <p className="flex items-center gap-1 text-sm font-semibold tracking-wide text-white/70 uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading mt-1 text-lg font-semibold text-white/90">{title}</h1>
        <div className="font-heading mt-3 text-4xl font-bold tracking-tight">{value}</div>
        <p className="mt-1 text-sm text-white/70">{valueLabel}</p>
        {caption ? <p className="mt-3 text-sm text-white/60">{caption}</p> : null}
        {badge ? (
          <span className="mt-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}
