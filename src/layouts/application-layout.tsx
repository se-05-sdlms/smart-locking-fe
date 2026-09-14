import type { AppRole } from '@/config/navigation';

import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { AppHeader } from '@/components/navigation/app-header';
import { AppSidebar } from '@/components/navigation/app-sidebar';

export default function ApplicationLayout({ role }: { role: AppRole }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
      <AppSidebar
        isCollapsed={isSidebarCollapsed}
        role={role}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader role={role} />
        <main className="min-h-0 flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
