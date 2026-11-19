"use client";

import { PageHeading } from "@/components/applicant/primitives";
import { SectionCard } from "@/components/applicant/SectionCard";
import { Field, FormGrid, INPUT_CLS } from "@/components/applicant/apply/parts";
import { AccountSecurityActions } from "@/components/shared/AccountSecurityActions";
import { usePortalSignOut } from "@/lib/ui/use-portal-sign-out";
import { useLiveAdminProfile } from "@/lib/admin/ops/identity";
import { AdminAvatar } from "../AdminAvatar";
import { AppearanceSection } from "./sections";

/** Live settings never load the fixture account, its devices, scopes or agreements. */
export function LiveSettingsBody() {
  const profile = useLiveAdminProfile();
  const signOut = usePortalSignOut("admin", { title: "Sign out of Beeliv Admin?", description: "You will be signed out on this device.", confirmLabel: "Sign out", cancelLabel: "Stay signed in" });
  return <div>
    <PageHeading title="Settings" subtitle="Manage your account and preferences." />
    <div className="flex min-w-0 flex-col gap-5">
      <SectionCard id="s-profile" title="Account & profile">
        <div className="mb-5 flex items-center gap-3.5">
          <AdminAvatar name={profile?.fullName || "Your account"} size={64} />
          <b className="block truncate text-[18px] text-(--ap-ink)">{profile?.fullName || "Your account"}</b>
        </div>
        {profile ? <FormGrid>
          <Field label="Full name" htmlFor="live-account-name"><input id="live-account-name" className={INPUT_CLS} readOnly value={profile.fullName} /></Field>
          <Field label="Phone number" htmlFor="live-account-phone"><input id="live-account-phone" className={INPUT_CLS} readOnly value={profile.phone || "Not added"} /></Field>
          <Field label="Email" htmlFor="live-account-email"><input id="live-account-email" className={INPUT_CLS} readOnly value={profile.email} /></Field>
        </FormGrid> : <p className="ap-sm" role="status">Your account details are unavailable. Refresh the page to try again.</p>}
        <p className="ap-sm mt-4">Managed by your Beeliv sign-in. Contact Beeliv if your details need updating.</p>
      </SectionCard>
      <AccountSecurityActions onSignOut={() => void signOut()} />
      <AppearanceSection />
    </div>
  </div>;
}
