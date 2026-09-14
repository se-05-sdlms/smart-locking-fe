import { Route, Routes } from 'react-router-dom';

import LoginPage from '@/pages/login';
import AdminPage from '@/pages/admin';
import OperatorPage from '@/pages/operator';
import DocsPage from '@/pages/docs';
import PricingPage from '@/pages/pricing';
import BlogPage from '@/pages/blog';
import AboutPage from '@/pages/about';

function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/" />
      <Route element={<AdminPage />} path="/admin" />
      <Route element={<OperatorPage />} path="/operator" />
      <Route element={<DocsPage />} path="/docs" />
      <Route element={<PricingPage />} path="/pricing" />
      <Route element={<BlogPage />} path="/blog" />
      <Route element={<AboutPage />} path="/about" />
    </Routes>
  );
}

export default App;
