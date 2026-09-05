import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/nav-config";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      roleLabel={ROLE_LABELS.ops}
      scopeLabel="All outlets"
      navItems={NAV_ITEMS.ops}
      userName="Sample Operations Lead"
      notificationCount={5}
      navTone="purple"
    >
      {children}
    </AppShell>
  );
}
