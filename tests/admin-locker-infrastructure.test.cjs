const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS modules with a stubbed API boundary. No HTTP, session or secrets.
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
    assert.ok(['@/constants/admin-locker', '@/services/admin-locker-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/admin-locker-service'), ApiError };
}

const summaryDto = (code, overrides = {}) => ({
  id: `id-${code}`,
  code,
  address: `Địa chỉ ${code}`,
  recoveryAddress: `Tập kết ${code}`,
  deviceIdentifier: `DEV-${code}`,
  operationalStatus: 0,
  connectionStatus: 0,
  lastSeenAt: null,
  totalCompartments: 2,
  activeCompartments: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const values = (overrides = {}) => ({
  code: 'LK-01',
  address: 'Số 1 Đường A',
  recoveryAddress: 'Phòng bảo vệ',
  deviceIdentifier: 'ESP-01',
  operationalStatus: 'Operational',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

test('numeric enums map in backend order; unknown values fall back', () => {
  const { service } = harness();

  assert.deepEqual([0, 1, 2].map(service.toOperationalStatus), ['Operational', 'OutOfService', 'Inactive']);
  assert.deepEqual([0, 1, 2].map(service.toConnectionStatus), ['Online', 'Offline', 'Unknown']);
  assert.deepEqual([0, 1, 2].map(service.toDoorStatus), ['Open', 'Closed', 'Unknown']);
  assert.equal(service.toOperationalStatus(7), 'Unknown');
  assert.equal(service.toConnectionStatus('Offline'), 'Offline');
});

test('detail derives counters from compartments and sorts codes naturally', () => {
  const { service } = harness();
  const { totalCompartments, activeCompartments, ...rest } = summaryDto('LK-01');
  void totalCompartments;
  void activeCompartments;
  const detail = service.mapAdminLockerDetail({
    ...rest,
    compartments: [
      { id: 'c10', lockerId: 'x', code: 'A10', hardwareCode: 'H10', hardwareChannel: 10, operationalStatus: 0, doorStatus: 1, createdAt: '', updatedAt: '' },
      { id: 'c2', lockerId: 'x', code: 'A2', hardwareCode: 'H2', hardwareChannel: 2, operationalStatus: 1, doorStatus: 0, createdAt: '', updatedAt: '' },
    ],
  });

  assert.deepEqual(detail.compartments.map((item) => item.code), ['A2', 'A10']);
  assert.equal(detail.totalCompartments, 2);
  assert.equal(detail.activeCompartments, 1);
  assert.equal(detail.compartments[0].doorStatus, 'Open');
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

test('filter separates configuration status from reported connection', () => {
  const { service } = harness();
  const lockers = [
    service.mapAdminLocker(summaryDto('A', { operationalStatus: 0, connectionStatus: 1 })),
    service.mapAdminLocker(summaryDto('B', { operationalStatus: 1, connectionStatus: 0 })),
    service.mapAdminLocker(summaryDto('C', { operationalStatus: 2, connectionStatus: 0 })),
  ];
  const codes = (filter, keyword = '') => service.filterAdminLockers(lockers, keyword, filter).map((l) => l.code);

  assert.deepEqual(codes('all'), ['A', 'B', 'C']);
  assert.deepEqual(codes('operational'), ['A']);
  assert.deepEqual(codes('out-of-service'), ['B']);
  assert.deepEqual(codes('inactive'), ['C']);
  assert.deepEqual(codes('offline'), ['A']);
  assert.deepEqual(codes('all', 'dev-b'), ['B']);
  assert.deepEqual(codes('all', 'tập kết c'), ['C']);
});

// ---------------------------------------------------------------------------
// Validation (mirrors LockerService)
// ---------------------------------------------------------------------------

test('valid locker form has no errors', () => {
  const { service } = harness();

  assert.deepEqual(service.validateLockerForm(values()), {});
});

test('required locker fields are reported in Vietnamese', () => {
  const { service } = harness();
  const errors = service.validateLockerForm(values({ code: ' ', address: '', recoveryAddress: '', deviceIdentifier: '' }));

  assert.equal(errors.code, 'Vui lòng nhập mã tủ.');
  assert.equal(errors.address, 'Vui lòng nhập địa chỉ.');
  assert.equal(errors.recoveryAddress, 'Vui lòng nhập địa chỉ tập kết hàng quá hạn.');
  assert.equal(errors.deviceIdentifier, 'Vui lòng nhập mã thiết bị.');
});

test('locker field limits match the backend', () => {
  const { service } = harness();

  assert.deepEqual(service.validateLockerForm(values({ code: 'x'.repeat(50) })), {});
  assert.equal(service.validateLockerForm(values({ code: 'x'.repeat(51) })).code, 'Mã tủ không được vượt quá 50 ký tự.');
  assert.ok(service.validateLockerForm(values({ address: 'x'.repeat(501) })).address);
  assert.ok(service.validateLockerForm(values({ recoveryAddress: 'x'.repeat(501) })).recoveryAddress);
  assert.ok(service.validateLockerForm(values({ deviceIdentifier: 'x'.repeat(101) })).deviceIdentifier);
});

test('compartment form requires a positive integer channel', () => {
  const { service } = harness();
  const valid = { code: 'A01', hardwareCode: 'CH01', hardwareChannel: '1' };

  assert.deepEqual(service.validateCompartmentForm(valid), {});
  for (const channel of ['0', '-1', '1.5', 'abc']) {
    assert.equal(
      service.validateCompartmentForm({ ...valid, hardwareChannel: channel }).hardwareChannel,
      'Kênh phần cứng phải là số nguyên lớn hơn 0.',
      channel,
    );
  }
  assert.equal(service.validateCompartmentForm({ ...valid, hardwareChannel: '' }).hardwareChannel, 'Vui lòng nhập kênh phần cứng.');
  assert.ok(service.validateCompartmentForm({ ...valid, code: 'x'.repeat(51) }).code);
  assert.ok(service.validateCompartmentForm({ ...valid, hardwareCode: 'x'.repeat(101) }).hardwareCode);
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

test('create request trims fields and omits operational status', () => {
  const { service } = harness();

  assert.deepEqual(service.buildCreateLockerRequest(values({ code: '  LK-02 ' })), {
    code: 'LK-02',
    address: 'Số 1 Đường A',
    recoveryAddress: 'Phòng bảo vệ',
    deviceIdentifier: 'ESP-01',
  });
});

test('update request sends the numeric operational status', () => {
  const { service } = harness();

  assert.equal(service.buildUpdateLockerRequest(values({ operationalStatus: 'OutOfService' })).operationalStatus, 1);
  assert.equal(service.buildUpdateLockerRequest(values({ operationalStatus: 'Inactive' })).operationalStatus, 2);
});

test('compartment request converts the channel to a number', () => {
  const { service } = harness();

  assert.deepEqual(service.buildCreateCompartmentRequest({ code: ' A01 ', hardwareCode: ' CH01 ', hardwareChannel: ' 3 ' }), {
    code: 'A01',
    hardwareCode: 'CH01',
    hardwareChannel: 3,
  });
});

test('form values default to Operational for a new locker', () => {
  const { service } = harness();

  assert.equal(service.toLockerFormValues().operationalStatus, 'Operational');
  assert.equal(service.toLockerFormValues(service.mapAdminLocker(summaryDto('A', { operationalStatus: 2 }))).operationalStatus, 'Inactive');
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('API calls use the Lockers endpoints and methods', async () => {
  const calls = [];
  const detail = { ...summaryDto('LK-01'), compartments: [] };
  const { service } = harness(async (url, options) => {
    calls.push({ url, method: options?.method ?? 'GET', body: options?.body });
    if (options?.method === 'DELETE') return undefined;
    if (url.endsWith('/compartments')) {
      return { id: 'c', lockerId: 'id', code: 'A01', hardwareCode: 'CH01', hardwareChannel: 1, operationalStatus: 0, doorStatus: 2, createdAt: '', updatedAt: '' };
    }
    if (url === '/api/Lockers' && !options?.method) return [summaryDto('LK-10'), summaryDto('LK-2')];
    return detail;
  });

  const list = await service.listAdminLockers();
  await service.createLocker(values());
  await service.updateLocker('id-1', values({ operationalStatus: 'OutOfService' }));
  await service.deactivateLocker('id-1');
  await service.createCompartment('id-1', { code: 'A01', hardwareCode: 'CH01', hardwareChannel: '1' });

  assert.deepEqual(list.map((l) => l.code), ['LK-2', 'LK-10']);
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.url}`),
    [
      'GET /api/Lockers',
      'POST /api/Lockers',
      'PUT /api/Lockers/id-1',
      'DELETE /api/Lockers/id-1',
      'POST /api/Lockers/id-1/compartments',
    ],
  );
  assert.equal(JSON.parse(calls[2].body).operationalStatus, 1);
  assert.equal(JSON.parse(calls[4].body).hardwareChannel, 1);
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

test('backend error codes are mapped to Vietnamese, never echoed (UC-24)', () => {
  const { service, ApiError } = harness();
  const message = (status, code, errors) =>
    service.getAdminLockerErrorMessage(new ApiError(status, 'English detail', code, errors));

  assert.match(message(409, 'locker/active_operations'), /còn bưu kiện, hàng trả hoặc lượt giữ chỗ/);
  assert.match(message(409, 'locker/compartment_already_exists'), /đã được dùng trong tủ này/);
  assert.equal(message(409, 'locker/code_already_exists'), 'Mã tủ đã tồn tại.');
  assert.match(message(409, 'locker/device_already_exists'), /tủ khác/);
  assert.match(message(409, 'locker/not_operational'), /vô hiệu hóa/);
  assert.match(message(404, 'locker/invalid_compartment'), /Không tìm thấy ngăn/);
  // Validation errors use the field key (PascalCase from nameof is normalised).
  assert.match(message(400, 'validation/invalid_input', { HardwareChannel: ['x'] }), /số nguyên dương/);
  assert.match(message(400, 'validation/invalid_input', { deviceIdentifier: ['x'] }), /Mã thiết bị/);
  assert.equal(message(400, 'validation/invalid_input'), 'Thông tin tủ chưa hợp lệ. Vui lòng kiểm tra lại.');
});

test('English or empty 400 messages fall back to Vietnamese', () => {
  const { service, ApiError } = harness();

  assert.equal(service.getAdminLockerErrorMessage(new ApiError(400, 'Bad Request')), 'Thông tin tủ chưa hợp lệ. Vui lòng kiểm tra lại.');
  assert.equal(service.getAdminLockerErrorMessage(new ApiError(403, '')), 'Bạn không có quyền thực hiện thao tác này.');
  assert.match(service.getAdminLockerErrorMessage(new ApiError(404, 'x')), /Không tìm thấy tủ/);
  assert.match(service.getAdminLockerErrorMessage(new ApiError(500, 'x')), /Máy chủ đang gặp sự cố/);
  assert.equal(service.getAdminLockerErrorMessage(undefined), 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
});

test('compartment edit and status call the Administrator compartment APIs', async () => {
  const calls = [];
  const { service } = harness(async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    return { id: 'c-1', code: 'A01', hardwareCode: 'HW-1', hardwareChannel: 3, operationalStatus: 2, doorStatus: 0 };
  });

  await service.updateCompartment('l 1', 'c-1', { code: ' A01 ', hardwareCode: ' HW-1 ', hardwareChannel: '3' });
  await service.setCompartmentStatus('l-1', 'c-1', 'Inactive');
  await service.setCompartmentStatus('l-1', 'c-1', 'Operational');

  assert.equal(calls[0].url, '/api/Lockers/l%201/compartments/c-1');
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual(calls[0].body, { code: 'A01', hardwareCode: 'HW-1', hardwareChannel: 3 });
  assert.equal(calls[1].url, '/api/Lockers/l-1/compartments/c-1/status');
  assert.deepEqual(calls[1].body, { operationalStatus: 2 });
  assert.deepEqual(calls[2].body, { operationalStatus: 0 });
});

test('compartment toggle target and edit form values', () => {
  const { service } = harness();

  assert.equal(service.getCompartmentStatusTarget('Operational'), 'Inactive');
  assert.equal(service.getCompartmentStatusTarget('OutOfService'), 'Inactive');
  assert.equal(service.getCompartmentStatusTarget('Inactive'), 'Operational');
  assert.deepEqual(
    service.toCompartmentFormValues({ code: 'A01', hardwareCode: 'HW-1', hardwareChannel: 3 }),
    { code: 'A01', hardwareCode: 'HW-1', hardwareChannel: '3' },
  );
});
