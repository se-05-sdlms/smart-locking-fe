import type { AppRole } from '@/config/navigation';

import { Route, Routes } from 'react-router-dom';

import EmptyRoutePage from '@/pages/empty-route';
import LoginPage from '@/pages/login';
import ForbiddenPage from '@/pages/forbidden';
import UserManagementPage from '@/pages/admin/user-management-page';
import AdminDashboardPage from '@/pages/admin/dashboard';
import AdminLockersPage from '@/pages/admin/lockers';
import AdminAuditLogsPage from '@/pages/admin/audit-logs';
import OperatorLockersPage from '@/pages/operator/lockers';
import OperatorLockerDetailPage from '@/pages/operator/locker-detail';
import OperatorOverdueClearancePage from '@/pages/operator/overdue-clearance';
import OperatorDashboardPage from '@/pages/operator/dashboard';
import OperatorSettingsPage from '@/pages/operator/settings';
import OperatorMaintenancePage from '@/pages/operator/maintenance';
import OperatorOperationalHistoryPage from '@/pages/operator/operational-history';
import OperatorIncidentsPage from '@/pages/operator/incidents';
import AdminReportsPage from '@/pages/admin/reports';
import AdminSettingsPage from '@/pages/admin/settings';
import AdminSystemPoliciesPage from '@/pages/admin/system-policies';
import AdminOperatorAssignmentsPage from '@/pages/admin/operator-assignments';
import ApplicationLayout from '@/layouts/application-layout';
import { getNavigationItems } from '@/config/navigation';
import { RequirePasswordChange, RequireRole } from '@/auth/route-guards';
import { FIRST_LOGIN_CHANGE_PASSWORD_PATH } from '@/auth/password-change';
import FirstLoginChangePasswordPage from '@/pages/operator/first-login-change-password';

function roleRoute(role: AppRole) {
  const basePath = `/${role}`;

  return (
    <Route
      element={
        <RequireRole role={role}>
          <ApplicationLayout role={role} />
        </RequireRole>
      }
      path={basePath}
    >
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
            <Route element={<OperatorLockerDetailPage />} path=":lockerId" />
          </Route>
        ) : item.path === '/operator/overdue-clearance' ? (
          <Route key={item.path} path="overdue-clearance">
            <Route index element={<OperatorOverdueClearancePage />} />
            <Route
              element={<OperatorOverdueClearancePage />}
              path=":parcelId"
            />
          </Route>
        ) : item.path === '/operator/settings' ? (
          <Route
            key={item.path}
            element={<OperatorSettingsPage />}
            path="settings"
          />
        ) : item.path === '/operator/operational-history' ? (
          <Route
            key={item.path}
            element={<OperatorOperationalHistoryPage />}
            path="operational-history"
          />
        ) : item.path === '/operator/incidents' ? (
          <Route
            key={item.path}
            element={<OperatorIncidentsPage />}
            path="incidents"
          />
        ) : item.path === '/operator/maintenance' ? (
          <Route
            key={item.path}
            element={<OperatorMaintenancePage />}
            path="maintenance"
          />
        ) : (
          <Route
            key={item.path}
            element={
              item.path === '/admin/users' ? (
                <UserManagementPage />
              ) : item.path === '/admin/lockers' ? (
                <AdminLockersPage />
              ) : item.path === '/admin/policies' ? (
                <AdminSystemPoliciesPage />
              ) : item.path === '/admin/operators' ? (
                <AdminOperatorAssignmentsPage />
              ) : item.path === '/admin/audit-logs' ? (
                <AdminAuditLogsPage />
              ) : item.path === '/admin/reports' ? (
                <AdminReportsPage />
              ) : item.path === '/admin/settings' ? (
                <AdminSettingsPage />
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
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <RequirePasswordChange>
            <FirstLoginChangePasswordPage />
          </RequirePasswordChange>
        }
        path={FIRST_LOGIN_CHANGE_PASSWORD_PATH}
      />
      {(['admin', 'operator'] as const).map(roleRoute)}
      <Route element={<ForbiddenPage />} path="/forbidden" />
    </Routes>
  );
}

export default App;
