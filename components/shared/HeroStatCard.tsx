// Base color per dashboard tone — keep in sync with AppShell's
// NAV_TONE_STYLES anchor tokens (Ops --primary, HR --tone-gold) so a
// dashboard's hero card and its nav sidebar always resolve to the exact
// same color (project-lead: "so they can have matching color").
const TONE_BASE: Record<"purple" | "gold" | "lavender" | "slate", string> = {
  purple: "var(--primary)",
  gold: "var(--tone-gold)",
  lavender: "var(--chart-2)",
  slate: "var(--foreground)",
};

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
}: {
  eyebrow: React.ReactNode;
  title: string;
  value: React.ReactNode;
  valueLabel: string;
  caption?: React.ReactNode;
  badge?: React.ReactNode;
  /** Matches the dashboard's own AppShell navTone — only "gold" (HR) is
   *  wired up so far; other tones are reserved for when this rolls out to
   *  Ops/Staff/Client. */
  tone?: "purple" | "gold" | "lavender" | "slate";
}) {
  const base = TONE_BASE[tone];
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-5 text-white sm:px-6 sm:py-6"
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
      {/* Faint decorative circle, gold-rimmed — the "touch of gold"
          restraint used elsewhere (e.g. the role-badge pill), same quiet
          motif as the homepage hero's blobs. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full border border-[color:var(--gold)]/40 bg-white/5"
      />
      <div className="relative">
        <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-white/70 uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading mt-1 text-lg font-semibold text-white/90">{title}</h1>
        <div className="font-heading mt-3 text-4xl font-bold tracking-tight">{value}</div>
        <p className="mt-1 text-sm text-white/70">{valueLabel}</p>
        {caption ? <p className="mt-3 text-xs text-white/60">{caption}</p> : null}
        {badge ? (
          <span className="mt-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}
