import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
      <UpgradeModal />
    </div>
  );
}
