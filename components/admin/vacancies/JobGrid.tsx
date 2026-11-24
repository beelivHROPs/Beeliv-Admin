"use client";

/**
 * Admin Jobs grid (lead-approved board v4, 2026-11-24). One photo card per job:
 * photo by role keyword (or a deep plum gradient), glass client and status chips,
 * title and "location · type · department", pay (only when the record has it) and
 * the champagne date line, the hiring track with REAL counts only, and the notch
 * badge (gold ring = hired / openings when known) around the round open button.
 *
 * Accessibility: each card is an <article> with ONE stretched link (named by the
 * title) under the face; the track stops are their own links above it, so no link
 * sits inside another. The face ignores pointer events except on the stops, so a
 * click anywhere else, the notch badge included, lands on the card link.
 * Styles: app/admin/admin.css "ADMIN JOBS GRID" (light and dark tokens).
 */
import Image from "next/image";
import Link from "next/link";
import { useId } from "react";
import { listCardPhoto } from "@/lib/admin/vacancies/jobPhotos";
import type { VacancyRow, VacancyStatus } from "@/lib/admin/vacancies/types";
import { CARD_STATUS_LABEL, jobCardDateText, publicSalaryText, STATUS_TONE } from "./meta";

const detailHref = (id: string) => `/admin/recruitment/vacancies/${id}`;
const applicantsTabHref = (id: string) => `/admin/recruitment/vacancies/${id}?tab=applicants`;

/** Status dot on the dark photo: bright enough to read on the overlay in both themes. */
const DOT: Record<string, string> = { ok: "#4ade80", warn: "#fbbf24", info: "#93c5fd", mute: "#c9bfc5", danger: "#fb7185" };

/**
 * The stops we have real numbers for. Counts are cumulative (applied >= shortlisted >= interviewed).
 * The board's fourth stop ("Offer") has no count in the vacancy data yet, so it is not drawn: no invented numbers.
 */
const STOPS = [
  { key: "applications", label: "Applied", todo: (n: number) => `${n} ${n === 1 ? "applicant" : "applicants"} to review` },
  { key: "shortlisted", label: "Shortlisted", todo: (n: number) => `${n} shortlisted to decide on` },
  { key: "interviewed", label: "Interview", todo: (n: number) => `${n} at interview` },
] as const;

/** Jobs whose applicants HR is still working on: the furthest stop with people is lit and named in the pill. */
const WORKING: VacancyStatus[] = ["published", "closing-soon", "paused"];
const NOT_LIVE_YET: VacancyStatus[] = ["draft", "pending-approval"];

const RING = 2 * Math.PI * 27;

export function JobGrid({ rows }: { rows: VacancyRow[] }) {
  return (
    <ul className="ad-jobs-grid m-0 list-none p-0" aria-label="Jobs">
      {rows.map((r) => (
        <li key={r.id} className="flex min-w-0">
          <JobCard r={r} />
        </li>
      ))}
    </ul>
  );
}

function PayLine({ r }: { r: VacancyRow }) {
  const s = r.salary;
  if (!s || (s.min === null && s.max === null)) return null;
  const text = publicSalaryText(s);
  const cut = text.indexOf(" / ");
  return (
    <p className="ad-job-pay">
      {cut === -1 ? text : text.slice(0, cut)}
      {cut === -1 ? null : <span className="ad-job-per">{text.slice(cut)}</span>}
    </p>
  );
}

function JobCard({ r }: { r: VacancyRow }) {
  const titleId = useId();
  const photo = listCardPhoto(r.title, r.department);
  const counts = r.countsReady === false ? null : r.counts;
  const sub = [r.location, r.employmentType, r.department].filter(Boolean).join(" · ");
  const client = r.outlet?.name ? `${r.client.name} · ${r.outlet.name}` : r.client.name;
  const status = CARD_STATUS_LABEL[r.status];

  const values = counts ? STOPS.map((s) => counts[s.key]) : [];
  const working = WORKING.includes(r.status);
  let hot = -1;
  if (counts && working) for (let i = values.length - 1; i >= 0; i--) if (values[i] > 0) { hot = i; break; }

  const filled = counts && r.openings > 0 ? Math.max(0, Math.min(1, counts.placed / r.openings)) : 0;
  const ringLabel = counts && r.openings > 0 ? `${counts.placed} of ${r.openings} ${r.openings === 1 ? "opening" : "openings"} filled` : "Filled count not available yet";

  let quiet: string | null = null;
  if (r.status === "draft") quiet = "Finish and submit this job to start receiving applicants.";
  else if (r.status === "pending-approval") quiet = "Applicants appear here once the job is published.";
  else if (r.status === "cancelled") quiet = "This job was cancelled.";
  else if (!counts) quiet = "Applicant numbers will show here once they are connected.";
  else if (working && hot === -1) quiet = "No applicants yet.";

  const showTrack = !!counts && !NOT_LIVE_YET.includes(r.status) && r.status !== "cancelled";

  return (
    <article className="ad-job" aria-labelledby={titleId}>
      {/* The one card link: sits under the face, covers the whole card (the notch badge too). */}
      <Link href={detailHref(r.id)} aria-labelledby={titleId} className="ad-job-link" />
      <div className="ad-job-face">
        <div className={`ad-job-photo${photo ? "" : " ad-job-photo-none"}`}>
          {photo ? <Image src={photo} alt="" fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="ad-job-img" /> : null}
          <span className="ad-job-glass ad-job-client">
            <span className="truncate">{client}</span>
          </span>
          <span className="ad-job-glass ad-job-state" style={{ "--c": DOT[STATUS_TONE[r.status]] ?? DOT.mute } as React.CSSProperties}>
            <span className="sr-only">Status: </span>
            {status}
          </span>
          <div className="ad-job-title">
            <h3 id={titleId} className="ap-serif">
              {r.title}
            </h3>
            {sub ? <p>{sub}</p> : null}
          </div>
        </div>
        <div className="ad-job-body">
          <PayLine r={r} />
          <p className="ad-job-date">{jobCardDateText(r)}</p>
          {showTrack ? (
            <ol className="ad-job-track" aria-label="Hiring progress" style={{ "--n": STOPS.length } as React.CSSProperties}>
              {STOPS.map((s, i) => {
                const n = values[i];
                const state = i === hot ? "hot" : n > 0 ? "done" : "zero";
                return (
                  <li key={s.key} className="ad-job-stop" data-state={state}>
                    <Link href={applicantsTabHref(r.id)} aria-label={`${s.label}: ${n}. Open the applicants for ${r.title}`} aria-current={i === hot ? "step" : undefined}>
                      <span className="ad-job-n">{n}</span>
                      <span className="ad-job-l">{s.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <div className="ad-job-todo">
            {hot >= 0 ? <span className="ad-job-pill">{STOPS[hot].todo(values[hot])}</span> : quiet ? <span className="ad-job-quiet">{quiet}</span> : null}
          </div>
        </div>
      </div>
      <span className="ad-job-badge" role="img" aria-label={ringLabel}>
        <svg className="ad-job-ring" viewBox="0 0 58 58" aria-hidden="true">
          <circle className="ad-job-rtrack" cx="29" cy="29" r="27" />
          {filled > 0 ? <circle className="ad-job-rfill" cx="29" cy="29" r="27" strokeDasharray={`${(RING * filled).toFixed(1)} ${RING.toFixed(1)}`} /> : null}
        </svg>
        <span className="ad-job-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </span>
      </span>
    </article>
  );
}

/** Loading state shaped like the grid: photo block, two lines, a track row, per card. */
export function JobGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="ad-jobs-grid m-0 list-none p-0" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex min-w-0">
          <div className="ad-job-skel">
            <div className="ap-shimmer h-[172px] max-[767px]:h-[150px]" />
            <div className="flex flex-col gap-2.5 p-5">
              <div className="ap-shimmer h-5 w-2/3 rounded-lg" />
              <div className="ap-shimmer h-4 w-1/3 rounded-lg" />
              <div className="mt-3 grid grid-cols-3 gap-6">
                <div className="ap-shimmer mx-auto size-9 rounded-full" />
                <div className="ap-shimmer mx-auto size-9 rounded-full" />
                <div className="ap-shimmer mx-auto size-9 rounded-full" />
              </div>
              <div className="ap-shimmer mt-3 h-8 w-1/2 rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
