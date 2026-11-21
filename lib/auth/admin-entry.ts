import type { SetupSummary } from "./setup-wire";

/** Presentation only. rev6 emits false explicitly only for a previously active
 * setup whose same-app session still needs promotion. An absent flag is NOT proof. */
export function returningAdminNeedsMfa(setup: SetupSummary): boolean {
  return setup.app === "admin" && setup.state === "pending-setup" &&
    setup.reacceptRequired === false && setup.mfaRequired && !setup.mfaVerified &&
    setup.contentReady && setup.agreements.every(a => !a.required || a.response === true);
}
