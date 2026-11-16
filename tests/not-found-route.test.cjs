const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter, createRoutesFromChildren, matchRoutes } = require('react-router-dom');

function load(relative, auth = { isLoading: false, session: null }) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (!name.startsWith('@/')) return require(name);
    if (name === '@/auth/auth-context') return { useAuth: () => auth };
    if (name === '@/types/auth') return load('src/types/auth.ts', auth);
    if (name === '@/auth/password-change') return load('src/auth/password-change.ts', auth);
    if (name === '@/config/navigation') return { getNavigationItems: () => [] };
    if (name === '@/pages/not-found') return load('src/pages/not-found.tsx', auth);
    return { default: () => null };
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

const session = (role, extra = {}) => ({ user: { role, status: 'Active', mustChangePassword: false, ...extra } });
for (const [name, value, target, label] of [
  ['guest', null, '/login', 'Về trang đăng nhập'],
  ['administrator', session('Administrator'), '/admin', 'Về trang tổng quan'],
  ['operator', session('LockerOperator'), '/operator', 'Về trang tổng quan'],
  ['temporary operator', session('LockerOperator', { mustChangePassword: true }), '/operator/first-login-change-password', 'Đổi mật khẩu để tiếp tục'],
  ['unsupported role', session('Resident'), '/forbidden', 'Xem quyền truy cập'],
  ['disabled', session('Administrator', { status: 'Disabled' }), '/forbidden', 'Xem quyền truy cập'],
  ['locked', session('LockerOperator', { status: 'Locked' }), '/forbidden', 'Xem quyền truy cập'],
]) {
  test(`404 recovery respects ${name} session`, () => {
    const Page = load('src/pages/not-found.tsx', { isLoading: false, session: value }).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)));
    assert.match(html, /<main/);
    assert.match(html, /<h1[^>]*>Không tìm thấy trang<\/h1>/);
    assert.ok(html.includes(`href="${target}"`));
    assert.ok(html.includes(label));
    assert.equal((html.match(/<a /g) || []).length, 1);
  });
}

test('404 waits for restored session before offering a destination', () => {
  const Page = load('src/pages/not-found.tsx', { isLoading: true, session: null }).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)));
  assert.match(html, /role="status"/);
  assert.match(html, /Đang kiểm tra phiên đăng nhập/);
  assert.doesNotMatch(html, /<a /);
});

test('actual App routes recover unknown root/admin/operator URLs and retain known routes', () => {
  const App = load('src/App.tsx').default;
  const routes = createRoutesFromChildren(App().props.children);
  for (const url of ['/not-a-route', '/admin/not-a-route', '/operator/not-a-route', '/operator/a/b/c']) {
    const matches = matchRoutes(routes, url);
    assert.equal(matches.at(-1).route.path, '*', url);
    assert.equal(matches.at(-1).route.element.type.name, 'NotFoundPage', url);
  }
  for (const url of ['/', '/login', '/forbidden', '/operator/first-login-change-password']) {
    assert.notEqual(matchRoutes(routes, url).at(-1).route.path, '*', url);
  }
});
