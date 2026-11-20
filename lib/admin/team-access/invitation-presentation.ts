import { formatDate, formatRelativePast } from "../../applicant/time";
import type { Invitation } from "./types";

const validDate = (value: string | null | undefined): value is string => !!value && Number.isFinite(Date.parse(value));

export function invitationCreator(invitation: Invitation): string {
  const creator = invitation.invitedBy.trim();
  return creator ? `Created by ${creator}` : "Creator unavailable";
}

export function invitationTiming(invitation: Invitation): string {
  if (invitation.status === "pending") return validDate(invitation.expiresAt) ? `Expires ${formatDate(invitation.expiresAt)}` : "Expiry unavailable";
  if (invitation.status === "expired") return validDate(invitation.expiresAt) ? `Expired ${formatDate(invitation.expiresAt)}` : "Expiry unavailable";
  return validDate(invitation.invitedAt) ? `Created ${formatDate(invitation.invitedAt)}` : "Creation date unavailable";
}

export function invitationDeliveryNote(invitation: Invitation): string {
  const attemptedAt = invitation.delivery.lastAttemptAt;
  if (invitation.delivery.status === "copied") return validDate(attemptedAt) ? `Link created ${formatRelativePast(attemptedAt)}` : "Access link created";
  if (validDate(attemptedAt)) return `Last attempt ${formatRelativePast(attemptedAt)}, delivery: ${invitation.delivery.status}`;
  if (invitation.delivery.status === "queued") return "Awaiting delivery confirmation";
  if (invitation.delivery.status === "sent") return "Email sent";
  if (invitation.delivery.status === "failed") return "Delivery could not be confirmed";
  return "Nothing sent yet";
}
