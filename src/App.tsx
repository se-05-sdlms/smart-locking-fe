import type { AppRole } from '@/config/navigation';

import { Route, Routes } from 'react-router-dom';

import AboutPage from '@/pages/about';
import BlogPage from '@/pages/blog';
import EmptyRoutePage from '@/pages/empty-route';
import DocsPage from '@/pages/docs';
import LoginPage from '@/pages/login';
import PricingPage from '@/pages/pricing';
import OperatorLockersPage from '@/pages/operator/lockers';
import OperatorLockerDetailPage from '@/pages/operator/locker-detail';
import ApplicationLayout from '@/layouts/application-layout';
import { getNavigationItems } from '@/config/navigation';

function roleRoute(role: AppRole) {
  const basePath = `/${role}`;

  return (
    <Route element={<ApplicationLayout role={role} />} path={basePath}>
      {getNavigationItems(role).map((item) =>
        item.path === basePath ? (
          <Route key={item.path} index element={<EmptyRoutePage />} />
        ) : item.path === '/operator/lockers' ? (
          <Route key={item.path} path="lockers">
            <Route index element={<OperatorLockersPage />} />
            <Route path=":lockerId" element={<OperatorLockerDetailPage />} />
          </Route>
        ) : (
          <Route
            key={item.path}
            element={<EmptyRoutePage />}
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
