import type { AppRole } from '@/config/navigation';

import { Route, Routes } from 'react-router-dom';

import AboutPage from '@/pages/about';
import BlogPage from '@/pages/blog';
import EmptyRoutePage from '@/pages/empty-route';
import DocsPage from '@/pages/docs';
import LoginPage from '@/pages/login';
import PricingPage from '@/pages/pricing';
import UserManagementPage from '@/pages/admin/user-management-page';
import AdminDashboardPage from '@/pages/admin/dashboard';
import AdminLockersPage from '@/pages/admin/lockers';
import AdminAuditLogsPage from '@/pages/admin/audit-logs';
import OperatorLockersPage from '@/pages/operator/lockers';
import OperatorLockerDetailPage from '@/pages/operator/locker-detail';
import OperatorOverdueClearancePage from '@/pages/operator/overdue-clearance';
import OperatorDashboardPage from '@/pages/operator/dashboard';
import OperatorSettingsPage from '@/pages/operator/settings';
import ApplicationLayout from '@/layouts/application-layout';
import { getNavigationItems } from '@/config/navigation';

function roleRoute(role: AppRole) {
  const basePath = `/${role}`;

  return (
    <Route element={<ApplicationLayout role={role} />} path={basePath}>
      {getNavigationItems(role).map((item) =>
        item.path === basePath ? (
          <Route
            key={item.path}
            index
            element={
              role === 'operator' ? (
                <OperatorDashboardPage />
              ) : (
                <AdminDashboardPage />
              )
            }
          />
        ) : item.path === '/operator/lockers' ? (
          <Route key={item.path} path="lockers">
            <Route index element={<OperatorLockersPage />} />
            <Route path=":lockerId" element={<OperatorLockerDetailPage />} />
          </Route>
        ) : item.path === '/operator/overdue-clearance' ? (
          <Route key={item.path} path="overdue-clearance">
            <Route index element={<OperatorOverdueClearancePage />} />
            <Route
              path=":parcelId"
              element={<OperatorOverdueClearancePage />}
            />
          </Route>
        ) : item.path === '/operator/settings' ? (
          <Route
            key={item.path}
            path="settings"
            element={<OperatorSettingsPage />}
          />
        ) : (
          <Route
            key={item.path}
            element={
              item.path === '/admin/users' ? (
                <UserManagementPage />
              ) : item.path === '/admin/lockers' ? (
                <AdminLockersPage />
              ) : item.path === '/admin/audit-logs' ? (
                <AdminAuditLogsPage />
              ) : (
                <EmptyRoutePage />
              )
            }
            path={item.path.slice(`${basePath}/`.length)}
          />
        ),
      )}
    </Route>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/" />
      {(['admin', 'operator'] as const).map(roleRoute)}
      <Route element={<DocsPage />} path="/docs" />
      <Route element={<PricingPage />} path="/pricing" />
      <Route element={<BlogPage />} path="/blog" />
      <Route element={<AboutPage />} path="/about" />
    </Routes>
  );
}

export default App;
