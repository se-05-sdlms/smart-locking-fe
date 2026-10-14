const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS modules with a stubbed API boundary. No HTTP, session or secrets.
function harness(request = async () => undefined) {
  const cache = new Map();
  class ApiError extends Error {
    constructor(status, message = '') {
      super(message);
      this.status = status;
    }
  }
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok([
      '@/auth/account-display',
      '@/services/operator-account-service',
    ].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return {
    display: load('@/auth/account-display'),
    service: load('@/services/operator-account-service'),
    ApiError,
  };
}

const locker = (code, overrides = {}) => ({
  id: `id-${code}`,
  code,
  address: `Địa chỉ ${code}`,
  recoveryAddress: 'Điểm tập kết',
  deviceIdentifier: `esp32-${code}`,
  operationalStatus: 0,
  connectionStatus: 0,
  lastSeenAt: null,
  totalCompartments: 12,
  activeCompartments: 10,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

test('every backend role has a Vietnamese label', () => {
  const { display } = harness();

  assert.deepEqual(display.ACCOUNT_ROLE_LABELS, {
    Administrator: 'Quản trị viên',
    LockerOperator: 'Nhân viên vận hành',
    Resident: 'Cư dân',
  });
});

test('account status uses the shared "Hoạt động" / "Đã khóa" wording', () => {
  const { display } = harness();

  assert.deepEqual(display.ACCOUNT_STATUS_DISPLAY.Active, {
    label: 'Hoạt động',
    color: 'success',
  });
  assert.deepEqual(display.ACCOUNT_STATUS_DISPLAY.Disabled, {
    label: 'Đã khóa',
    color: 'danger',
  });
  assert.deepEqual(display.ACCOUNT_STATUS_DISPLAY.Locked, {
    label: 'Đã khóa',
    color: 'danger',
  });
});

test('missing optional profile text shows a Vietnamese placeholder', () => {
  const { display } = harness();

  assert.equal(display.formatOptionalText(null), 'Chưa cập nhật');
  assert.equal(display.formatOptionalText(undefined), 'Chưa cập nhật');
  assert.equal(display.formatOptionalText(''), 'Chưa cập nhật');
  assert.equal(display.formatOptionalText('   '), 'Chưa cập nhật');
});

test('present profile text is trimmed and shown as-is', () => {
  const { display } = harness();

  assert.equal(display.formatOptionalText(' operator@test.local '), 'operator@test.local');
  assert.equal(display.formatOptionalText('0901234567'), '0901234567');
});

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

test('date-times are formatted with the vi-VN locale', () => {
  const { display } = harness();
  const value = '2026-10-14T07:44:16Z';
  const expected = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

  assert.equal(display.formatAccountDateTime(value), expected);
});

test('missing or invalid date-times fall back to a placeholder', () => {
  const { display } = harness();

  assert.equal(display.formatAccountDateTime(null), 'Chưa cập nhật');
  assert.equal(display.formatAccountDateTime(undefined), 'Chưa cập nhật');
  assert.equal(display.formatAccountDateTime('not-a-date'), 'Chưa cập nhật');
  assert.equal(display.formatAccountDateTime(null, 'Chưa đăng nhập'), 'Chưa đăng nhập');
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('assigned lockers are read from /api/Lockers and backend scoping is trusted', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return [locker('LK-02'), locker('LK-01')];
  });

  const result = await service.getAssignedLockers();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/Lockers');
  assert.equal(calls[0].options.method, undefined);
  assert.deepEqual(result.map((item) => item.code), ['LK-01', 'LK-02']);
});

test('assigned lockers expose only id, code and address', async () => {
  const { service } = harness(async () => [locker('LK-01')]);

  assert.deepEqual(await service.getAssignedLockers(), [
    { id: 'id-LK-01', code: 'LK-01', address: 'Địa chỉ LK-01' },
  ]);
});

test('assigned lockers also accept a paged response shape', async () => {
  const { service } = harness(async () => ({
    items: [locker('LK-09'), locker('LK-03')],
    totalCount: 2,
    pageNumber: 1,
    pageSize: 20,
  }));

  assert.deepEqual(
    (await service.getAssignedLockers()).map((item) => item.code),
    ['LK-03', 'LK-09'],
  );
});

test('an operator without assignments gets an empty list', async () => {
  const { service } = harness(async () => []);

  assert.deepEqual(await service.getAssignedLockers(), []);
});

test('locker codes are sorted naturally for Vietnamese users', async () => {
  const { service } = harness(async () => [locker('LK-B'), locker('LK-A'), locker('LK-Đ')]);

  assert.deepEqual(
    (await service.getAssignedLockers()).map((item) => item.code),
    ['LK-A', 'LK-B', 'LK-Đ'],
  );
});

test('backend errors propagate to the page', async () => {
  const { service, ApiError } = harness(async () => {
    throw new ApiError(500, 'boom');
  });

  await assert.rejects(service.getAssignedLockers(), (error) => error.status === 500);
});

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

test('load errors are translated to Vietnamese', () => {
  const { service, ApiError } = harness();
  const message = (status) =>
    service.getAccountLoadErrorMessage(new ApiError(status, 'raw'));

  assert.equal(message(0), 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  assert.equal(message(401), 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  assert.equal(message(403), 'Bạn không có quyền xem thông tin này.');
  assert.equal(message(408), 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.');
  assert.equal(message(500), 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
  assert.equal(message(502), 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
});

test('unknown load errors never leak raw English text', () => {
  const { service, ApiError } = harness();
  const fallback = 'Không thể tải dữ liệu. Vui lòng thử lại.';

  assert.equal(service.getAccountLoadErrorMessage(new ApiError(404, 'Not Found')), fallback);
  assert.equal(service.getAccountLoadErrorMessage(new Error('boom')), fallback);
  assert.equal(service.getAccountLoadErrorMessage(undefined), fallback);
});
