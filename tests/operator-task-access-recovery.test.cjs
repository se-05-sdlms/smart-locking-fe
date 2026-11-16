const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Render the actual page function and async-resource hook with a small hook runner.
// UI primitives are inert JSX nodes; HTTP is the only data boundary.
function harness(initialTasks) {
  const slots = [];
  const cache = new Map();
  let cursor = 0;
  const effects = [];
  let calls = 0;
  let rejectReload;
  const task = (id) => ({ kind: 'incident', id, lockerId: id, lockerCode: id, title: id, priority: 'High', status: 'Open', dueAt: null });
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((dep, i) => dep !== slots[index].deps[i])) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = fn(); });
      }
    },
  };
  class ApiError extends Error {}
  const ui = new Proxy({}, { get: (_, key) => key === 'toast' ? { warning() {} } : new Proxy(function () {}, { get: (_, child) => `${String(key)}.${String(child)}` }) });
  function load(name) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '@heroui/react') return ui;
    if (name.startsWith('@gravity-ui/')) return { default: () => null };
    if (name === 'react-router-dom') return { Link: 'Link' };
    if (name === '@/auth/auth-context') return { useAuth: () => ({ user: { id: 'operator' } }) };
    if (name === '@/services/api-client') return { ApiError, apiRequest: async () => {
      calls++;
      if (calls === 1) return { items: initialTasks ?? [task('a'), task('b')], hasMore: false };
      if (calls === 2) return new Promise((_, reject) => { rejectReload = reject; });
      return { items: [task('b')], hasMore: false };
    } };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/pages/operator/tasks', '@/hooks/use-async-resource', '@/services/operator-task-service', '@/constants/error-codes'].includes(name));
    const extension = name.includes('/pages/') ? 'tsx' : 'ts';
    const code = ts.transpileModule(readFileSync(path.join(__dirname, '..', 'src', `${name.slice(2)}.${extension}`), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} }; cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  const { OperatorTasksView } = load('@/pages/operator/tasks');
  return {
    render() { cursor = 0; const tree = OperatorTasksView({ mode: 'operator' }); while (effects.length) effects.shift()(); return tree; },
    failReload() { rejectReload(new Error('Network unavailable')); },
    get calls() { return calls; },
  };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) { for (const child of node) { const match = find(child, predicate); if (match) return match; } return undefined; }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('actual task rows show source assignee, never the viewing operator, without detail requests', async () => {
  const base = { kind: 'incident', lockerId: 'locker', lockerCode: 'LKR', priority: 'High', status: 'Open', dueAt: null };
  const h = harness([
    { ...base, id: 'assigned', title: 'Assigned incident', assignedOperatorUserId: 'owner', assignedOperatorName: 'Người được giao xử lý' },
    { ...base, id: 'unnamed', title: 'Missing display name', assignedOperatorUserId: 'owner-id', assignedOperatorName: null },
    { ...base, id: 'unassigned', title: 'Unassigned incident', assignedOperatorUserId: null, assignedOperatorName: null },
    { ...base, kind: 'maintenance', id: 'maintenance', title: 'Maintenance', assignedOperatorUserId: null, assignedOperatorName: null },
    { ...base, kind: 'recovery', id: 'recovery', title: 'Recovery', assignedOperatorUserId: null, assignedOperatorName: null },
  ]);
  h.render(); await settle();
  const tree = h.render();
  const row = (id) => find(tree, node => node.type === 'Table.Row' && node.props.id.endsWith(`:${id}`));
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : '';
  assert.match(text(row('assigned')), /Người được giao xử lý/);
  assert.match(text(row('unnamed')), /owner-id/);
  for (const id of ['unassigned', 'maintenance', 'recovery']) assert.match(text(row(id)), /Chưa phân công riêng/);
  assert.equal(h.calls, 1);
  find(tree, node => node.type === 'Table.Content').props.onRowAction('incident:assigned');
  const drawer = find(h.render(), node => node.type?.name === 'TaskDrawer');
  assert.equal(drawer.props.task.assignedOperatorUserId, 'owner');
  assert.equal(drawer.props.task.assignedOperatorName, 'Người được giao xử lý');
  assert.equal(h.calls, 1);
});
test('access loss removes stale actions while refetch is pending and failed, then retry restores only permitted locker', async () => {
  const h = harness(); h.render(); await settle();
  let tree = h.render();
  const table = find(tree, (node) => node.type === 'Table.Content');
  table.props.onRowAction('incident:a');
  tree = h.render();
  const drawer = find(tree, (node) => node.type?.name === 'TaskDrawer');
  assert.equal(drawer.props.task.id, 'a');
  drawer.props.onAccessLost();
  tree = h.render();
  assert.equal(find(tree, (node) => node.type === 'Table.Row'), undefined);
  assert.equal(find(tree, (node) => node.type?.name === 'TaskDrawer'), undefined);
  h.failReload(); await settle();
  tree = h.render();
  assert.equal(find(tree, (node) => node.type === 'Table.Row'), undefined);
  // Retry via the page's existing reload button, after failure.
  const retry = find(tree, (node) => Array.isArray(node.props?.children) && node.props.children.includes('Tải lại'));
  retry.props.onPress(); h.render(); await settle(); tree = h.render();
  const row = find(tree, (node) => node.type === 'Table.Row');
  assert.equal(row.props.id, 'incident:b');
  find(tree, (node) => node.type === 'Table.Content').props.onRowAction('incident:b');
  assert.equal(find(h.render(), (node) => node.type?.name === 'TaskDrawer').props.task.id, 'b');
});
