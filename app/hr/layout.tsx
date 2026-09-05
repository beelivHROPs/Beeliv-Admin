import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS, ROLE_LABELS } from "@/lib/nav-config";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      roleLabel={ROLE_LABELS.hr}
      scopeLabel="Sample Outlet 1"
      navItems={NAV_ITEMS.hr}
      userName="Ngozi Eze"
      notificationCount={3}
      navTone="gold"
    >
      {children}
    </AppShell>
  );
}
