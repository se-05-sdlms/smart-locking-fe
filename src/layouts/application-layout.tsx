import type { AppRole } from '@/config/navigation';

import { useEffect, useState } from 'react';
import { Drawer } from '@heroui/react';
import Bars from '@gravity-ui/icons/Bars';
import { Outlet, useLocation } from 'react-router-dom';

import { AppHeader } from '@/components/navigation/app-header';
import { AppSidebar } from '@/components/navigation/app-sidebar';

export default function ApplicationLayout({ role }: { role: AppRole }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setIsMenuOpen(false), [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMenuOpen(false);
    };

    desktop.addEventListener('change', closeOnDesktop);

    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <div className="hidden shrink-0 lg:block">
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          role={role}
          onCollapsedChange={setIsSidebarCollapsed}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          menuTrigger={
            <Drawer isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <Drawer.Trigger
                aria-label="Mở menu điều hướng"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
              >
                <Bars aria-hidden="true" className="size-5" />
              </Drawer.Trigger>
              <Drawer.Backdrop>
                <Drawer.Content placement="left">
                  <Drawer.Dialog className="p-0">
                    <Drawer.Heading className="sr-only">
                      Menu điều hướng
                    </Drawer.Heading>
                    <AppSidebar
                      isMobile
                      isCollapsed={false}
                      role={role}
                      onCollapsedChange={() => setIsMenuOpen(false)}
                      onNavigate={() => setIsMenuOpen(false)}
                    />
                  </Drawer.Dialog>
                </Drawer.Content>
              </Drawer.Backdrop>
            </Drawer>
          }
          role={role}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
