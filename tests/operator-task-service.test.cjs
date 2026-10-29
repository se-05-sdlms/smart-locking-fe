const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function harness(request = async () => undefined) {
  class ApiError extends Error {
    constructor(status, message = '', code, errors) {
      super(message);
      this.status = status;
      this.code = code;
      this.errors = errors;
    }
  }
  const cache = new Map();
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/services/operator-task-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/operator-task-service'), ApiError };
}

const task = (overrides = {}) => ({ kind: 'incident', id: 'i-1', lockerId: 'l-1', lockerCode: 'LKR-1', title: 'Cửa kẹt', priority: 'High', status: 'Open', dueAt: null, createdAt: '2026-10-28T00:00:00Z', sourcePath: '/api/incidents/i-1', ...overrides });

test('source links open the original record, filters and locker options', () => {
  const { service } = harness();

  assert.equal(service.taskSourceHref(task()), '/operator/incidents?incident=i-1');
  assert.equal(service.taskSourceHref(task({ kind: 'maintenance' })), '/operator/maintenance');
  assert.equal(service.taskSourceHref(task({ kind: 'recovery' })), '/operator/overdue-clearance');
  const tasks = [task(), task({ id: 'm-1', kind: 'maintenance', lockerId: 'l-2', lockerCode: 'LKR-0' })];
  assert.deepEqual(service.filterTasks(tasks, { lockerId: 'l-2', kind: '' }).map((t) => t.id), ['m-1']);
  assert.deepEqual(service.filterTasks(tasks, { lockerId: '', kind: 'incident' }).map((t) => t.id), ['i-1']);
  assert.deepEqual(service.lockerOptions(tasks).map((l) => l.code), ['LKR-0', 'LKR-1']);
  assert.ok(service.isTaskOverdue(task({ dueAt: '2026-10-01T00:00:00Z' }), Date.parse('2026-10-02T00:00:00Z')));
  assert.ok(!service.isTaskOverdue(task()));
  assert.equal(service.priorityLabel('Critical'), 'Khẩn cấp');
});

test('handover validation and acknowledgement rules', () => {
  const { service } = harness();
  const handover = { id: 'h-1', authorUserId: 'a', acknowledgements: [{ receiverUserId: 'b' }] };

  assert.deepEqual(service.validateHandoverForm({ workDone: 'Đã kiểm tra', blockers: '', nextSteps: 'Thay khóa' }), {});
  const errors = service.validateHandoverForm({ workDone: ' ', blockers: 'x'.repeat(2001), nextSteps: '' });
  assert.ok(errors.workDone && errors.blockers && errors.nextSteps);
  assert.equal(service.canAcknowledge(handover, 'a'), false);
  assert.equal(service.canAcknowledge(handover, 'b'), false);
  assert.equal(service.canAcknowledge(handover, 'c'), true);
  assert.equal(service.canAcknowledge(handover, undefined), false);
});

test('endpoints and access loss', async () => {
  const calls = [];
  const { service, ApiError } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return {}; });

  await service.listTasks(100);
  await service.getHandovers(task());
  await service.createHandover(task({ kind: 'recovery', id: 'p-1' }), { workDone: ' a ', blockers: '', nextSteps: ' b ' });
  await service.acknowledgeHandover('h-1', ' ok ');
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET /api/operator-tasks?offset=100&limit=100',
    'GET /api/operator-tasks/incident/i-1/handovers',
    'POST /api/operator-tasks/recovery/p-1/handovers',
    'POST /api/operator-tasks/handovers/h-1/acknowledgements',
  ]);
  assert.deepEqual(calls[2].body, { workDone: 'a', blockers: '', nextSteps: 'b', intendedReceiverUserId: null });
  assert.deepEqual(calls[3].body, { notes: 'ok' });
  assert.ok(service.isAccessLost(new ApiError(403, '')));
  assert.match(service.getTaskErrorMessage(new ApiError(403, '', 'locker/access_denied')), /không còn quyền/);
  assert.match(service.getTaskErrorMessage(new ApiError(409, '', 'TASK_CLOSED')), /đã đóng/);
});
