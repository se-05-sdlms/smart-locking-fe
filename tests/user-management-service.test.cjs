const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS service with a stubbed API boundary. No HTTP, session or secrets.
function harness(request, timeoutMs) {
  const cache = new Map();
  const events = new EventTarget();
  class ApiError extends Error {
    constructor(status, message = '') {
      super(message);
      this.status = status;
    }
  }
  function load(name) {
    if (name === '@/auth/auth-storage') return { AUTH_SESSION_CHANGED_EVENT: 'session-changed', AUTH_FORBIDDEN_EVENT: 'forbidden', readAuthSession: () => ({ user: { id: 'admin-test' } }) };
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok([
      '@/services/user-management-service',
      '@/services/user-management-query',
      '@/services/user-management-requests',
      '@/constants/user-management',
    ].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'window', code)(
      load, module, module.exports,
      (fn, duration) => setTimeout(fn, timeoutMs ?? duration), clearTimeout, events,
    );
    return module.exports;
  }
  return { service: load('@/services/user-management-service').userManagementService, ApiError, events, requests: load('@/services/user-management-requests') };
}

const row = (id, overrides = {}) => ({
  id, fullName: `Người dùng ${id}`, phoneNumber: null, email: null,
  role: 2, status: 0, activeAssignmentsCount: 0,
  createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null, ...overrides,
});
const detail = (id, overrides = {}) => ({
  ...row(id), avatarUrl: null, assignments: [], mustChangePassword: false,
  updatedAt: '2026-01-01T00:00:00Z', ...overrides,
});
const page = (items, totalCount = items.length, pageNumber = 1) => ({
  items, totalCount, pageNumber, pageSize: 100,
});
const filters = (overrides = {}) => ({
  role: 'LOCKER_OPERATOR', search: '', status: 'ALL',
  sortDescriptor: { column: 'createdAt', direction: 'descending' },
  page: 1, pageSize: 20, ...overrides,
});
function data(result) {
  assert.equal(result.success, true);
  return result.data;
}

test('loads every backend page before search/sort/pagination; default bearer boundary', async () => {
  const calls = [];
  const rows = Array.from({ length: 103 }, (_, i) => row(`u-${i}`, {
    fullName: i === 102 ? 'An Nguyễn' : `User ${i}`,
    activeAssignmentsCount: i,
  }));
  const { service } = harness(async (url, options) => {
    const query = new URL(url, 'http://test').searchParams;
    const number = Number(query.get('PageNumber'));
    assert.equal(query.get('Role'), '2');
    assert.equal(options.auth, undefined);
    assert.equal(options.headers, undefined);
    calls.push(number);
    return page(rows.slice((number - 1) * 100, number * 100), 103, number);
  });
  const result = data(await service.getUsers(filters({
    pageSize: 1, sortDescriptor: { column: 'assignedLockerCount', direction: 'descending' },
  })));
  assert.equal(result.items[0].id, 'u-102');
  assert.equal(result.totalPages, 103);
  assert.deepEqual(calls, [1, 2]);
  const searched = data(await service.getUsers(filters({ search: '  AN NGUYỄN  ', page: 20 })));
  assert.equal(searched.totalItems, 1);
  assert.equal(searched.page, 1);
  assert.equal(searched.items[0].id, 'u-102');
});

test('empty list and status filter preserve pagination contract', async () => {
  const { service } = harness(async () => page([]));
  const result = data(await service.getUsers(filters({ page: 99 })));
  assert.deepEqual([result.items.length, result.totalItems, result.totalPages, result.page], [0, 0, 0, 1]);
  const activeService = harness(async () => page([row('a'), row('b', { status: 2 })])).service;
  assert.equal(data(await activeService.getUsers(filters({ status: 'LOCKED' }))).items[0].id, 'b');
});

test('maps Resident dates and nullable contacts without invented fields', async () => {
  const { service } = harness(async (url) => {
    assert.match(url, /Role=1/);
    return page([row('r', { role: 1 })]);
  });
  const user = data(await service.getUsers(filters({ role: 'RESIDENT' }))).items[0];
  assert.equal(user.role, 'RESIDENT');
  assert.equal(user.registeredAt, '2026-01-01T00:00:00Z');
  assert.equal(user.email, '');
  assert.equal(user.phoneNumber, '');
  assert.equal('employeeCode' in user, false);
});

test('detail counts only active assignments and does not invent employee code', async () => {
  const { service } = harness(async (url) => {
    assert.equal(url, '/api/Users/op');
    return detail('op', { assignments: [
      { lockerId: 'l1', revokedAt: null }, { lockerId: 'l2', revokedAt: '2026-01-01' },
    ] });
  });
  const user = data(await service.getUserById('op'));
  assert.equal(user.assignedLockerCount, 1);
  assert.equal(user.employeeCode, 'Chưa có dữ liệu');
});

test('sort is stable on equal values and invalid dates sort last', async () => {
  const { service } = harness(async () => page([
    row('b'), row('a'), row('invalid', { createdAt: 'not-a-date' }),
  ]));
  for (const direction of ['ascending', 'descending']) {
    const result = data(await service.getUsers(filters({ sortDescriptor: { column: 'createdAt', direction } })));
    assert.deepEqual(result.items.map((user) => user.id), ['a', 'b', 'invalid']);
  }
});

test('Disabled is not silently mapped to Locked or reactivated', async () => {
  let writes = 0;
  const { service } = harness(async (url, options) => {
    if (options.method) writes += 1;
    return url.includes('?') ? page([row('d', { status: 1 })]) : detail('d', { status: 1 });
  });
  assert.equal((await service.getUsers(filters())).error.code, 'UNSUPPORTED_CONTRACT');
  assert.equal((await service.unlockAccount({ userId: 'd', reasonCode: 'RESTORE_ACCESS' })).success, false);
  assert.equal(writes, 0);
});

test('pagination changes/duplicates never return misleading partial success', async () => {
  for (const mode of ['duplicate', 'count-change', 'empty']) {
    const { service } = harness(async (url) => {
      if (url.includes('PageNumber=1')) return page([row('a')], 2);
      return mode === 'duplicate' ? page([row('a')], 2, 2)
        : mode === 'count-change' ? page([row('b')], 3, 2) : page([], 2, 2);
    });
    assert.equal((await service.getUsers(filters())).success, false);
  }
});

test('lock/unlock send numeric status and Vietnamese reason; no client audit', async () => {
  for (const [method, status, currentStatus] of [['lockAccount', 2, 0], ['unlockAccount', 0, 2]]) {
    const writes = [];
    const { service } = harness(async (url, options) => {
      if (!options.method) return detail('op', { status: currentStatus });
      assert.equal(url, '/api/Users/op/status');
      assert.equal(options.method, 'PUT');
      writes.push(JSON.parse(options.body));
      return detail('op', { status });
    });
    data(await service[method]({ userId: 'op', reasonCode: 'OTHER', reasonDetail: '  Kiểm thử  ' }));
    assert.deepEqual(writes, [{ status, reason: 'Kiểm thử' }]);
  }
});

test('invalid reason and Administrator target never produce status writes', async () => {
  for (const role of [0, 1, 2]) {
    let writes = 0;
    const { service } = harness(async (_, options) => {
      if (options.method) writes += 1;
      return detail('target', { role });
    });
    const result = await service.lockAccount({ userId: 'target', reasonCode: 'OTHER', reasonDetail: '  ' });
    assert.equal(result.success, false);
    assert.equal(writes, 0);
  }
});

test('same-account double submit is rejected while first request completes', async () => {
  let release;
  let writes = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const { service } = harness(async (_, options) => {
    if (!options.method) { await gate; return detail('op'); }
    writes += 1;
    return detail('op', { status: 2 });
  });
  const request = { userId: 'op', reasonCode: 'MANAGEMENT_REQUEST' };
  const first = service.lockAccount(request);
  assert.equal((await service.lockAccount(request)).success, false);
  release();
  data(await first);
  assert.equal(writes, 1);
});

test('locker ownership derives from active assignments including disabled operators', async () => {
  const { service } = harness(async (url) => {
    if (url === '/api/Lockers') return ['l1', 'l2', 'l3'].map((id) => ({ id, code: id, address: 'Địa chỉ' }));
    if (url.includes('?')) return page([row('op', { activeAssignmentsCount: 1 }), row('disabled', { status: 1, activeAssignmentsCount: 1 })]);
    if (url.endsWith('/op')) return detail('op', { assignments: [{ lockerId: 'l1', revokedAt: null }, { lockerId: 'l3', revokedAt: '2026-01-01' }] });
    return detail('disabled', { status: 1, assignments: [{ lockerId: 'l2', revokedAt: null }] });
  });
  const snapshot = data(await service.getLockerAssignment('op'));
  assert.deepEqual(snapshot.assigned.map((locker) => locker.id), ['l1']);
  assert.deepEqual(snapshot.available.map((locker) => locker.id), ['l3']);
  assert.deepEqual(snapshot.assignedToOtherOperators.map((locker) => locker.id), ['l2']);
  assert.equal(snapshot.assigned[0].locationLabel, 'Địa chỉ');
  assert.equal(data(await service.getAvailableLockers()).length, 1);
});

test('conflicting assignment owners produce explicit error, not a fake owner', async () => {
  const { service } = harness(async (url) => {
    if (url === '/api/Lockers') return [{ id: 'l1', code: 'L1', address: '' }];
    if (url.includes('?')) return page([row('a', { activeAssignmentsCount: 1 }), row('b', { activeAssignmentsCount: 1 })]);
    return detail(url.endsWith('/a') ? 'a' : 'b', { assignments: [{ lockerId: 'l1', revokedAt: null }] });
  });
  assert.equal((await service.getAvailableLockers()).error.code, 'UNSUPPORTED_CONTRACT');
});

test('unsupported audit operation never calls API or mock', async () => {
  const { service } = harness(async () => { throw new Error('Unexpected API call'); });
  for (const result of await Promise.all([
    service.getAuditRecords(),
  ])) assert.equal(result.error.code, 'UNSUPPORTED_CONTRACT');
});

// Stateful API fixture: mirrors the confirmed numeric enums, soft revoke and response shapes.
// This is an isolated fixture, not the user's seeded database.
function mutationFixture({ users = [], lockerIds = ['l1', 'l2', 'l3'], before, after } = {}) {
  const accounts = new Map(users.map((user) => [user.id, structuredClone(user)]));
  const calls = [];
  let sequence = 0;
  const setup = harness(async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const parsed = new URL(url, 'http://fixture');
    const body = options.body ? JSON.parse(options.body) : undefined;
    const call = { method, path: parsed.pathname, query: parsed.searchParams, body };
    calls.push(call);
    await before?.(call, accounts, setup.ApiError);
    if (options.signal?.aborted) throw new setup.ApiError(0);
    let result;
    if (method === 'GET' && parsed.pathname === '/api/Lockers') {
      result = lockerIds.map((id) => ({ id, code: id, address: 'Địa chỉ thử nghiệm' }));
    } else if (method === 'GET' && parsed.pathname === '/api/Users') {
      const role = Number(parsed.searchParams.get('Role'));
      const rows = [...accounts.values()].filter((user) => user.role === role).map((user) => ({
        ...user, activeAssignmentsCount: user.assignments.filter((a) => a.revokedAt === null).length,
      }));
      result = page(rows);
    } else if (method === 'POST' && parsed.pathname === '/api/Users') {
      if ([...accounts.values()].some((user) => user.email === body.email || user.phoneNumber === body.phoneNumber)) {
        throw new setup.ApiError(409, 'Email hoặc số điện thoại đã được sử dụng.');
      }
      const id = `created-${++sequence}`;
      const assignments = body.lockerId ? [{ id: `a-${++sequence}`, lockerId: body.lockerId, revokedAt: null }] : [];
      accounts.set(id, detail(id, { fullName: body.fullName, email: body.email, phoneNumber: body.phoneNumber, assignments }));
      result = { id };
      // Reading this property would violate the non-disclosure requirement.
      Object.defineProperty(result, 'temporaryPassword', { get() { throw new Error('Unexpected sensitive property access'); } });
    } else {
      const parts = parsed.pathname.split('/');
      const user = accounts.get(parts[3]);
      if (!user) throw new setup.ApiError(404);
      if (method === 'GET' && parts.length === 4) {
        result = structuredClone(user);
      } else if (method === 'POST' && parts[4] === 'assignments') {
        if (user.assignments.some((a) => a.lockerId === body.lockerId && a.revokedAt === null)) {
          throw new setup.ApiError(400);
        }
        const assignment = { id: `a-${++sequence}`, lockerId: body.lockerId, revokedAt: null };
        user.assignments.push(assignment);
        result = structuredClone(assignment);
      } else if (method === 'DELETE' && parts[4] === 'assignments') {
        const assignment = user.assignments.find((a) => a.id === parts[5]);
        if (!assignment) throw new setup.ApiError(404);
        assignment.revokedAt = '2026-09-22T00:00:00Z';
      } else {
        throw new Error('Unexpected fixture request');
      }
    }
    await after?.(call, accounts, setup.ApiError);
    return result;
  });
  return { ...setup, accounts, calls };
}

const createRequest = (overrides = {}) => ({
  fullName: '  Nhân viên thử nghiệm  ', email: '  Operator@Example.test  ',
  phoneNumber: '090 123 4567', lockerIds: [], ...overrides,
});
const activeIds = (user) => user.assignments.filter((a) => a.revokedAt === null).map((a) => a.lockerId).sort();

test('create zero/one/multiple lockers uses exact DTO and reloads the new account', async () => {
  for (const lockerIds of [[], ['l1'], ['l1', 'l2', 'l3']]) {
    const fixture = mutationFixture();
    const result = data(await fixture.service.createOperator(createRequest({ lockerIds })));
    const creates = fixture.calls.filter((call) => call.method === 'POST' && call.path === '/api/Users');
    assert.equal(creates.length, 1);
    assert.deepEqual(creates[0].body, {
      fullName: 'Nhân viên thử nghiệm', email: 'operator@example.test', phoneNumber: '0901234567',
      role: 2, password: null, lockerId: lockerIds[0] ?? null,
      assignmentReason: lockerIds.length ? 'Phân công ban đầu khi tạo tài khoản' : null,
    });
    assert.equal(result.assignedLockerCount, lockerIds.length);
    assert.deepEqual(activeIds(fixture.accounts.get(result.id)), lockerIds);
    assert.ok(fixture.calls.some((call) => call.method === 'GET' && call.path === `/api/Users/${result.id}`));
    assert.equal('temporaryPassword' in result, false);
  }
});

test('create validation prevents writes for invalid contact/avatar/duplicate or unavailable lockers', async () => {
  for (const overrides of [
    { fullName: ' ' }, { email: 'bad' }, { phoneNumber: 'bad' }, { avatarUrl: 'data:image/png;base64,fixture' },
    { lockerIds: ['l1', 'l1'] }, { lockerIds: ['missing'] }, { lockerIds: ['l2'] },
  ]) {
    const fixture = mutationFixture({ users: [detail('other', { assignments: [{ id: 'busy', lockerId: 'l2', revokedAt: null }] })] });
    const result = await fixture.service.createOperator(createRequest(overrides));
    assert.equal(result.success, false);
    assert.equal(fixture.calls.some((call) => call.method !== 'GET'), false);
  }
});

test('backend duplicate email/phone gives Vietnamese error and no success', async () => {
  const fixture = mutationFixture({ users: [detail('existing', { email: 'operator@example.test' })] });
  const result = await fixture.service.createOperator(createRequest());
  assert.equal(result.success, false);
  assert.match(result.error.message, /Email hoặc số điện thoại đã được sử dụng/);
  assert.equal(result.error.reloadRequired, undefined);
  assert.equal(fixture.accounts.size, 1);
});

test('assignment replaces set using real assignment IDs for DELETE; preserves revoked history', async () => {
  const fixture = mutationFixture({ users: [detail('op', { assignments: [
    { id: 'retain-a', lockerId: 'l1', revokedAt: null },
    { id: 'remove-a', lockerId: 'l2', revokedAt: null },
    { id: 'history-a', lockerId: 'l3', revokedAt: '2025-01-01' },
  ] })] });
  const result = data(await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: ['l1', 'l3'] }));
  const writes = fixture.calls.filter((call) => call.method !== 'GET');
  assert.deepEqual(writes.map((call) => [call.method, call.path]), [
    ['POST', '/api/Users/op/assignments'], ['DELETE', '/api/Users/op/assignments/remove-a'],
  ]);
  assert.equal(writes[0].body.lockerId, 'l3');
  assert.equal(writes[1].query.get('reason'), 'Thu hồi phân công bởi quản trị viên');
  assert.deepEqual(activeIds(fixture.accounts.get('op')), ['l1', 'l3']);
  assert.equal(result.assignedLockerCount, 2);
  assert.equal(fixture.calls.at(-1).method, 'GET');
});

test('assignment no-op does not write; removing all uses DELETE and reloads count zero', async () => {
  const fixture = mutationFixture({ users: [detail('op', { assignments: [{ id: 'real-assignment-id', lockerId: 'l1', revokedAt: null }] })] });
  data(await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: ['l1'] }));
  assert.equal(fixture.calls.some((call) => call.method !== 'GET'), false);
  const cleared = data(await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: [] }));
  assert.equal(cleared.assignedLockerCount, 0);
  assert.deepEqual(activeIds(fixture.accounts.get('op')), []);
});

test('assignment failure halfway reports partial outcome; retry reads and sends only remaining delta', async () => {
  let failed = false;
  const fixture = mutationFixture({ users: [detail('op')], before(call, _, ApiError) {
    if (call.method === 'POST' && call.body.lockerId === 'l2' && !failed) {
      failed = true;
      throw new ApiError(500);
    }
  } });
  const request = { operatorId: 'op', lockerIds: ['l1', 'l2'] };
  const partial = await fixture.service.updateLockerAssignments(request);
  assert.equal(partial.success, false);
  assert.equal(partial.error.reloadRequired, true);
  assert.deepEqual(activeIds(fixture.accounts.get('op')), ['l1']);
  assert.equal(data(await fixture.service.updateLockerAssignments(request)).assignedLockerCount, 2);
  assert.equal(fixture.calls.filter((call) => call.method === 'POST' && call.body.lockerId === 'l1').length, 1);
});

test('partial create resumes same account without a second create POST', async () => {
  let failed = false;
  const fixture = mutationFixture({ before(call, _, ApiError) {
    if (call.method === 'POST' && call.path.endsWith('/assignments') && !failed) {
      failed = true;
      throw new ApiError(500);
    }
  } });
  const request = createRequest({ lockerIds: ['l1', 'l2'] });
  const partial = await fixture.service.createOperator(request);
  assert.equal(partial.success, false);
  assert.ok(partial.error.createdOperatorId);
  assert.equal(partial.error.reloadRequired, true);
  const result = data(await fixture.service.createOperator({ ...request, createdOperatorId: partial.error.createdOperatorId }));
  assert.equal(result.assignedLockerCount, 2);
  assert.equal(fixture.accounts.size, 1);
  assert.equal(fixture.calls.filter((call) => call.method === 'POST' && call.path === '/api/Users').length, 1);
});

test('lost creation response requests reconciliation, never returns fabricated success', async () => {
  const fixture = mutationFixture({ after(call, _, ApiError) {
    if (call.method === 'POST' && call.path === '/api/Users') throw new ApiError(408);
  } });
  const result = await fixture.service.createOperator(createRequest());
  assert.equal(result.success, false);
  assert.equal(result.error.reloadRequired, true);
  assert.equal(result.error.createdOperatorId, undefined);
  assert.equal(fixture.accounts.size, 1);
});

test('failed readback after successful write is not reported as successful save', async () => {
  let written = false;
  const fixture = mutationFixture({ users: [detail('op')], before(call, _, ApiError) {
    if (written && call.method === 'GET') throw new ApiError(500);
  }, after(call) { if (call.method === 'POST') written = true; } });
  const result = await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: ['l1'] });
  assert.equal(result.success, false);
  assert.equal(result.error.reloadRequired, true);
  assert.deepEqual(activeIds(fixture.accounts.get('op')), ['l1']);
});

test('readback that disagrees with requested assignments does not return success', async () => {
  const fixture = mutationFixture({ users: [detail('op')], after(call, accounts) {
    if (call.method === 'POST') accounts.get('op').assignments = [];
  } });
  const result = await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: ['l1'] });
  assert.equal(result.success, false);
  assert.equal(result.error.reloadRequired, true);
});

test('create and assignment writes cannot overlap in this tab', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fixture = mutationFixture({ before: () => gate });
  const first = fixture.service.createOperator(createRequest());
  assert.equal((await fixture.service.createOperator(createRequest())).success, false);
  assert.equal((await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: [] })).success, false);
  release();
  data(await first);
  assert.equal(fixture.accounts.size, 1);
});

test('concurrent revoke before readback cannot be reported as a verified assignment', async () => {
  let written = false;
  let changed = false;
  const fixture = mutationFixture({ users: [detail('op')], before(call, accounts) {
    if (written && !changed && call.method === 'GET' && call.path === '/api/Users/op') {
      changed = true;
      accounts.get('op').assignments = [];
    }
  }, after(call) { if (call.method === 'POST') written = true; } });
  const result = await fixture.service.updateLockerAssignments({ operatorId: 'op', lockerIds: ['l1'] });
  assert.equal(result.success, false);
  assert.equal(result.error.reloadRequired, true);
});

test('network/auth/service failures produce safe messages without raw payloads', async () => {
  for (const status of [0, 400, 401, 403, 404, 408, 409, 500]) {
    let ApiError;
    const setup = harness(async () => { throw new ApiError(status, 'RAW_BACKEND_DETAIL'); });
    ApiError = setup.ApiError;
    const result = await setup.service.getUserById('op');
    assert.equal(result.success, false);
    assert.equal(result.error.message.includes('RAW_BACKEND_DETAIL'), false);
  }
});

test('whole-operation timeout settles and aborts even a nonresponsive API stub', async () => {
  let signal;
  const { service } = harness(async (_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }, 15);
  const result = await service.getUserById('op');
  assert.equal(result.success, false);
  assert.match(result.error.message, /thời gian chờ/);
  assert.equal(signal.aborted, true);
});

test('detail view reads only the selected user and locker catalog, never all operators', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    if (url === '/api/Users/op') return detail('op', { assignments: [{ lockerId: 'l1', lockerCode: 'L1', revokedAt: null }] });
    if (url === '/api/Lockers') return [{ id: 'l1', code: 'L1', address: 'Địa chỉ' }];
    throw new Error('Unnecessary API scan');
  });
  const [first, second] = await Promise.all([service.getUserDetail('op'), service.getUserDetail('op')]);
  assert.equal(data(first).assigned[0].locationLabel, 'Địa chỉ');
  assert.equal(data(second).user.id, 'op');
  assert.deepEqual(calls, ['/api/Users/op', '/api/Lockers']);
});

test('short read cache avoids refetching all users on search/filter/sort/page changes', async () => {
  let calls = 0;
  const { service } = harness(async () => { calls += 1; return page([row('a'), row('b')]); });
  data(await service.getUsers(filters()));
  data(await service.getUsers(filters({ search: 'a' })));
  data(await service.getUsers(filters({ page: 2, pageSize: 1 })));
  assert.equal(calls, 1);
  service.invalidateCache();
  data(await service.getUsers(filters()));
  assert.equal(calls, 2);
});

test('429 has Vietnamese cooldown and repeated reads/writes do not hit API', async () => {
  let calls = 0;
  let ApiError;
  const setup = harness(async () => { calls += 1; throw new ApiError(429); });
  ApiError = setup.ApiError;
  const first = await setup.service.getUserById('a');
  const second = await setup.service.getUserById('a');
  const creation = await setup.service.createOperator(createRequest());
  for (const result of [first, second, creation]) {
    assert.equal(result.error.code, 'RATE_LIMITED');
    assert.match(result.error.message, /giới hạn số yêu cầu/);
    assert.ok(result.error.retryAfterMs > 0);
  }
  assert.equal(creation.error.reloadRequired, undefined);
  assert.equal(calls, 1);
});

test('session change clears private read cache while same-user refresh keeps pending reads alive', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const setup = harness(async () => { calls += 1; await gate; return detail('op'); });
  const pending = setup.service.getUserById('op');
  setup.events.dispatchEvent(new CustomEvent('session-changed', { detail: { user: { id: 'admin-test' } } }));
  release();
  data(await pending);
  data(await setup.service.getUserById('op'));
  assert.equal(calls, 1);
  setup.events.dispatchEvent(new Event('session-changed'));
  data(await setup.service.getUserById('op'));
  assert.equal(calls, 2);
});

test('one cancelled consumer cannot abort another consumer sharing a read', async () => {
  let release;
  let requestSignal;
  const gate = new Promise((resolve) => { release = resolve; });
  const setup = harness(async (_, options) => { requestSignal = options.signal; await gate; return detail('op'); });
  const first = new AbortController();
  const second = new AbortController();
  const rejected = setup.requests.readUserManagement('/api/Users/op', first.signal);
  const accepted = setup.requests.readUserManagement('/api/Users/op', second.signal);
  first.abort();
  await assert.rejects(rejected);
  assert.equal(requestSignal.aborted, false);
  release();
  assert.equal((await accepted).id, 'op');
});

test('seed-sized workflow stays below 100 requests and removal never scans other users', async () => {
  const seeded = Array.from({ length: 20 }, (_, i) => detail(`seed-op-${i}`, {
    assignments: [{ id: `seed-a-${i}`, lockerId: `seed-l-${i}`, revokedAt: null }],
  }));
  const fixture = mutationFixture({ users: seeded, lockerIds: ['l1', 'l2', ...seeded.map((_, i) => `seed-l-${i}`)] });
  data(await fixture.service.getAvailableLockers());
  const created = data(await fixture.service.createOperator(createRequest({ lockerIds: ['l1', 'l2'] })));
  data(await fixture.service.getUserDetail(created.id));
  const start = fixture.calls.length;
  data(await fixture.service.updateLockerAssignments({ operatorId: created.id, lockerIds: [] }));
  assert.ok(fixture.calls.slice(start).every((call) => call.path.startsWith(`/api/Users/${created.id}`)));
  data(await fixture.service.updateLockerAssignments({ operatorId: created.id, lockerIds: ['l1', 'l2'] }));
  data(await fixture.service.updateLockerAssignments({ operatorId: created.id, lockerIds: [] }));
  assert.ok(fixture.calls.length < 100, `Request budget exceeded: ${fixture.calls.length}`);
});
