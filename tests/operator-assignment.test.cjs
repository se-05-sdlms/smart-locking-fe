const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS module with a stubbed API boundary. No HTTP, session or secrets.
function harness(request = async () => undefined) {
  const cache = new Map();
  class ApiError extends Error {
    constructor(status, message = '', code, errors) {
      super(message);
      this.status = status;
      this.code = code;
      this.errors = errors;
    }
  }
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    if (name !== '@/constants/error-codes') assert.equal(name, '@/services/operator-assignment-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/operator-assignment-service'), ApiError };
}

const locker = (code) => ({ id: `l-${code}`, code, address: `Địa chỉ ${code}` });
const operator = (id, overrides = {}) => ({
  id, fullName: `Operator ${id}`, phoneNumber: null, email: `${id}@test.local`,
  role: 2, status: 0, activeAssignmentsCount: 0, createdAt: '', lastLoginAt: null, ...overrides,
});
const detail = (op, assignments) => ({ ...op, avatarUrl: null, mustChangePassword: false, updatedAt: '', assignments });
const assignment = (id, lockerId, revokedAt = null) => ({ id, lockerId, lockerCode: null, assignedAt: '2026-10-01T00:00:00Z', revokedAt, reason: null });

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

test('board derives each locker owner from active assignments only', () => {
  const { service } = harness();
  const a = operator('a', { activeAssignmentsCount: 1 });
  const board = service.buildAssignmentBoard(
    [locker('LK-10'), locker('LK-2')],
    [a, operator('b')],
    [detail(a, [assignment('as-1', 'l-LK-2'), assignment('as-old', 'l-LK-10', '2026-09-01T00:00:00Z')])],
  );

  assert.deepEqual(board.rows.map((row) => row.lockerCode), ['LK-2', 'LK-10'], 'natural code order');
  assert.equal(board.rows[0].operator.id, 'a');
  assert.equal(board.rows[0].assignmentId, 'as-1');
  assert.equal(board.rows[1].operator, null, 'revoked assignments do not own the locker');
  assert.equal(board.operators.length, 2);
});

test('locked operators are marked inactive and never offered for assignment', () => {
  const { service } = harness();
  const board = service.buildAssignmentBoard([locker('LK-1')], [operator('a'), operator('b', { status: 2 })], []);

  assert.deepEqual(board.operators.map((op) => [op.id, op.isActive]), [['a', true], ['b', false]]);
  assert.deepEqual(service.getAssignableOperators(board.operators, board.rows[0]).map((op) => op.id), ['a']);
});

test('the current owner is not offered when replacing', () => {
  const { service } = harness();
  const a = operator('a', { activeAssignmentsCount: 1 });
  const board = service.buildAssignmentBoard([locker('LK-1')], [a, operator('b')], [detail(a, [assignment('x', 'l-LK-1')])]);

  assert.deepEqual(service.getAssignableOperators(board.operators, board.rows[0]).map((op) => op.id), ['b']);
});

test('actions depend on whether the locker has an owner', () => {
  const { service } = harness();

  assert.deepEqual(service.getAssignmentActions({ operator: null }), ['assign']);
  assert.deepEqual(service.getAssignmentActions({ operator: { id: 'a' } }), ['replace', 'revoke']);
});

test('filter by assignment state and keyword (locker, address, operator)', () => {
  const { service } = harness();
  const a = operator('a', { activeAssignmentsCount: 1, fullName: 'Nguyễn Văn An' });
  const { rows } = service.buildAssignmentBoard([locker('LK-1'), locker('LK-2')], [a], [detail(a, [assignment('x', 'l-LK-1')])]);
  const codes = (filter, keyword = '') => service.filterAssignmentRows(rows, keyword, filter).map((row) => row.lockerCode);

  assert.deepEqual(codes('all'), ['LK-1', 'LK-2']);
  assert.deepEqual(codes('assigned'), ['LK-1']);
  assert.deepEqual(codes('unassigned'), ['LK-2']);
  assert.deepEqual(codes('all', 'nguyễn'), ['LK-1']);
  assert.deepEqual(codes('all', 'địa chỉ lk-2'), ['LK-2']);
});

test('reason is required and limited to 500 characters', () => {
  const { service } = harness();

  assert.equal(service.validateAssignmentReason('  '), 'Vui lòng nhập lý do.');
  assert.equal(service.validateAssignmentReason('a'.repeat(500)), undefined);
  assert.equal(service.validateAssignmentReason('a'.repeat(501)), 'Lý do không được vượt quá 500 ký tự.');
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('board loads lockers, all operator pages and details of operators with assignments', async () => {
  const calls = [];
  const a = operator('a', { activeAssignmentsCount: 1 });
  const { service } = harness(async (url) => {
    calls.push(url);
    if (url === '/api/Lockers') return [locker('LK-1')];
    if (url.includes('PageNumber=1')) return { items: [a], totalCount: 2, pageNumber: 1, pageSize: 100 };
    if (url.includes('PageNumber=2')) return { items: [operator('b')], totalCount: 2, pageNumber: 2, pageSize: 100 };
    if (url === '/api/Users/a') return detail(a, [assignment('x', 'l-LK-1')]);
    throw new Error(`unexpected ${url}`);
  });

  const board = await service.loadAssignmentBoard();

  assert.ok(calls.includes('/api/Users?Role=2&PageNumber=1&PageSize=100'));
  assert.ok(calls.includes('/api/Users?Role=2&PageNumber=2&PageSize=100'));
  assert.ok(calls.includes('/api/Users/a'));
  assert.ok(!calls.includes('/api/Users/b'), 'operators without assignments are not fetched');
  assert.equal(board.rows[0].operator.id, 'a');
});

test('assign POSTs the locker and trimmed reason', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => calls.push({ url, options }));

  await service.assignLocker('op 1', 'l-1', '  Ca sáng  ');

  assert.equal(calls[0].url, '/api/Users/op%201/assignments');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { lockerId: 'l-1', reason: 'Ca sáng' });
});

test('revoke DELETEs the assignment with the reason in the query', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => calls.push({ url, options }));

  await service.revokeAssignment('op-1', 'as-1', 'Nghỉ việc');

  assert.equal(calls[0].url, `/api/Users/op-1/assignments/as-1?reason=${encodeURIComponent('Nghỉ việc')}`);
  assert.equal(calls[0].options.method, 'DELETE');
});

test('replace revokes the current owner before assigning the new operator', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => calls.push(`${options.method} ${url.split('?')[0]}`));

  await service.replaceAssignment(
    { lockerId: 'l-1', lockerCode: 'LK-1', operator: { id: 'a' }, assignmentId: 'as-1' },
    'b',
    'Đổi ca',
  );

  assert.deepEqual(calls, ['DELETE /api/Users/a/assignments/as-1', 'POST /api/Users/b/assignments']);
});

test('replace reports a partial failure when the new assignment fails', async () => {
  const { service, ApiError } = harness(async (url, options) => {
    if (options.method === 'POST') throw new ApiError(409, 'conflict');
  });

  await assert.rejects(
    service.replaceAssignment({ lockerId: 'l-1', lockerCode: 'LK-1', operator: { id: 'a' }, assignmentId: 'as-1' }, 'b', 'Đổi ca'),
    (error) => error.name === 'PartialReplaceError',
  );
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

test('409 conflict and partial replace messages are explicit', () => {
  const { service, ApiError } = harness();

  assert.match(service.getAssignmentErrorMessage(new ApiError(409, 'x')), /đã được phân công cho nhân viên khác/);
  const partial = new service.PartialReplaceError(new ApiError(409, 'x'));
  assert.match(service.getAssignmentErrorMessage(partial), /Đã thu hồi Operator cũ/);
  assert.match(service.getAssignmentErrorMessage(partial), /chưa có người phụ trách/);
});

test('assignment errors are mapped by backend error code, never raw backend text', () => {
  const { service, ApiError } = harness();
  const message = (status, code) => service.getAssignmentErrorMessage(new ApiError(status, 'English detail', code));

  assert.match(message(409, 'user/assignment_conflict'), /đã được phân công/);
  assert.match(message(404, 'user/not_found'), /Không tìm thấy nhân viên/);
  assert.equal(message(409, 'user/inactive'), 'Nhân viên đã bị khóa nên không thể phân công.');
  assert.match(message(404, 'locker/not_found'), /Không tìm thấy tủ/);
  assert.equal(message(400, undefined), 'Thông tin phân công không hợp lệ.');
  assert.match(service.getAssignmentErrorMessage(new ApiError(500, 'x')), /Máy chủ đang gặp sự cố/);
  assert.equal(service.getAssignmentErrorMessage(undefined), 'Không thể xử lý phân công. Vui lòng thử lại.');
});
