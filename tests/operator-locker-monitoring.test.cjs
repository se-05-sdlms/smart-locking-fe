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
      '@/constants/operator-locker',
      '@/constants/operational-record',
      '@/services/operator-locker-mappers',
      '@/services/operator-locker-service',
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
    mappers: load('@/services/operator-locker-mappers'),
    service: load('@/services/operator-locker-service'),
    constants: load('@/constants/operator-locker'),
    records: load('@/constants/operational-record'),
    ApiError,
  };
}

const summaryDto = (code, overrides = {}) => ({
  id: `id-${code}`,
  code,
  address: `Địa chỉ ${code}`,
  recoveryAddress: `Điểm thu hồi ${code}`,
  deviceIdentifier: `DEVICE-${code}`,
  operationalStatus: 0,
  connectionStatus: 0,
  lastSeenAt: '2026-10-14T07:00:00Z',
  totalCompartments: 6,
  activeCompartments: 4,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const compartmentDto = (code, overrides = {}) => ({
  id: `c-${code}`,
  lockerId: 'id-LK-01',
  code,
  hardwareCode: `HW-${code}`,
  hardwareChannel: 1,
  operationalStatus: 0,
  doorStatus: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-10-14T07:00:00Z',
  ...overrides,
});

const detailDto = (compartments, overrides = {}) => {
  const { totalCompartments, activeCompartments, ...summary } = summaryDto('LK-01');
  void totalCompartments;
  void activeCompartments;
  return { ...summary, compartments, ...overrides };
};

const locker = (overrides = {}) => ({
  id: 'id',
  code: 'LK',
  address: 'Địa chỉ',
  recoveryAddress: 'Thu hồi',
  deviceIdentifier: 'DEVICE',
  operationalStatus: 'Operational',
  connectionStatus: 'Online',
  lastSeenAt: null,
  totalCompartments: 0,
  activeCompartments: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Enum mapping
// ---------------------------------------------------------------------------

test('numeric backend enums map in backend declaration order', () => {
  const { mappers } = harness();

  assert.deepEqual([0, 1, 2].map(mappers.toOperationalStatus), ['Operational', 'OutOfService', 'Inactive']);
  assert.deepEqual([0, 1, 2].map(mappers.toConnectionStatus), ['Online', 'Offline', 'Unknown']);
  assert.deepEqual([0, 1, 2].map(mappers.toDoorStatus), ['Open', 'Closed', 'Unknown']);
});

test('string enum names are accepted for a future JsonStringEnumConverter', () => {
  const { mappers } = harness();

  assert.equal(mappers.toOperationalStatus('OutOfService'), 'OutOfService');
  assert.equal(mappers.toConnectionStatus('Offline'), 'Offline');
  assert.equal(mappers.toDoorStatus('Open'), 'Open');
});

test('unexpected enum values fall back to Unknown instead of crashing', () => {
  const { mappers } = harness();

  for (const value of [3, -1, 1.5, 'Broken', null, undefined, {}]) {
    assert.equal(mappers.toOperationalStatus(value), 'Unknown');
    assert.equal(mappers.toConnectionStatus(value), 'Unknown');
    assert.equal(mappers.toDoorStatus(value), 'Unknown');
  }
});

test('view statuses map back to backend numbers for requests', () => {
  const { mappers } = harness();

  assert.equal(mappers.toOperationalStatusDto('Operational'), 0);
  assert.equal(mappers.toOperationalStatusDto('OutOfService'), 1);
});

// ---------------------------------------------------------------------------
// DTO -> view model
// ---------------------------------------------------------------------------

test('locker summary keeps backend counters and maps statuses', () => {
  const { mappers } = harness();
  const result = mappers.mapLockerSummary(summaryDto('LK-01', { connectionStatus: 1, operationalStatus: 1 }));

  assert.equal(result.code, 'LK-01');
  assert.equal(result.connectionStatus, 'Offline');
  assert.equal(result.operationalStatus, 'OutOfService');
  assert.equal(result.totalCompartments, 6);
  assert.equal(result.activeCompartments, 4);
  assert.equal(result.createdAt, undefined);
});

test('locker detail derives counters from compartments and sorts codes naturally', () => {
  const { mappers } = harness();
  const result = mappers.mapLockerDetail(detailDto([
    compartmentDto('A10'),
    compartmentDto('A2', { operationalStatus: 1 }),
    compartmentDto('A1', { operationalStatus: 2 }),
    compartmentDto('A3'),
  ]));

  assert.deepEqual(result.compartments.map((item) => item.code), ['A1', 'A2', 'A3', 'A10']);
  assert.equal(result.totalCompartments, 4);
  assert.equal(result.activeCompartments, 2);
});

test('compartment mapping separates operational status from reported door state', () => {
  const { mappers } = harness();
  const result = mappers.mapCompartment(compartmentDto('A1', { operationalStatus: 1, doorStatus: 0 }));

  assert.equal(result.operationalStatus, 'OutOfService');
  assert.equal(result.doorStatus, 'Open');
  assert.equal(result.hardwareCode, 'HW-A1');
});

test('replacing a compartment keeps order and recomputes the active counter', () => {
  const { mappers } = harness();
  const detail = mappers.mapLockerDetail(detailDto([compartmentDto('A1'), compartmentDto('A2')]));
  const updated = { ...detail.compartments[0], operationalStatus: 'OutOfService' };
  const result = mappers.replaceCompartment(detail, updated);

  assert.deepEqual(result.compartments.map((item) => item.code), ['A1', 'A2']);
  assert.equal(result.compartments[0].operationalStatus, 'OutOfService');
  assert.equal(result.activeCompartments, 1);
  assert.equal(detail.activeCompartments, 2, 'original detail is not mutated');
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

test('locker search matches code, address and device identifier case-insensitively', () => {
  const { mappers } = harness();
  const lockers = [
    locker({ id: '1', code: 'LK-01', address: 'Nguyễn Huệ', deviceIdentifier: 'ESP-A' }),
    locker({ id: '2', code: 'LK-02', address: 'Lê Lợi', deviceIdentifier: 'ESP-B' }),
  ];
  const ids = (keyword) => mappers.filterLockers(lockers, keyword, 'all').map((item) => item.id);

  assert.deepEqual(ids('lk-02'), ['2']);
  assert.deepEqual(ids('nguyễn'), ['1']);
  assert.deepEqual(ids('esp-b'), ['2']);
  assert.deepEqual(ids('   '), ['1', '2']);
  assert.deepEqual(ids('không có'), []);
});

test('locker filters separate connection from operational status', () => {
  const { mappers } = harness();
  const lockers = [
    locker({ id: 'online', connectionStatus: 'Online' }),
    locker({ id: 'offline', connectionStatus: 'Offline' }),
    locker({ id: 'unknown', connectionStatus: 'Unknown' }),
    locker({ id: 'oos', connectionStatus: 'Online', operationalStatus: 'OutOfService' }),
  ];
  const ids = (filter) => mappers.filterLockers(lockers, '', filter).map((item) => item.id);

  assert.deepEqual(ids('online'), ['online', 'oos']);
  assert.deepEqual(ids('offline'), ['offline']);
  assert.deepEqual(ids('unknown'), ['unknown']);
  assert.deepEqual(ids('out-of-service'), ['oos']);
  assert.deepEqual(ids('all'), ['online', 'offline', 'unknown', 'oos']);
});

test('compartment filters cover every status and open doors', () => {
  const { mappers } = harness();
  const compartments = [
    { code: 'A', operationalStatus: 'Operational', doorStatus: 'Closed' },
    { code: 'B', operationalStatus: 'OutOfService', doorStatus: 'Closed' },
    { code: 'C', operationalStatus: 'Inactive', doorStatus: 'Unknown' },
    { code: 'D', operationalStatus: 'Operational', doorStatus: 'Open' },
  ];
  const codes = (filter) =>
    compartments.filter((item) => mappers.matchesCompartmentFilter(item, filter)).map((item) => item.code);

  assert.deepEqual(codes('all'), ['A', 'B', 'C', 'D']);
  assert.deepEqual(codes('operational'), ['A', 'D']);
  assert.deepEqual(codes('out-of-service'), ['B']);
  assert.deepEqual(codes('inactive'), ['C']);
  assert.deepEqual(codes('door-open'), ['D']);
});

// ---------------------------------------------------------------------------
// Status actions
// ---------------------------------------------------------------------------

test('operator can take an operational compartment out of service', () => {
  const { mappers } = harness();

  assert.equal(
    mappers.getCompartmentStatusAction({ operationalStatus: 'Operational' }, { operationalStatus: 'Operational' }),
    'take-out-of-service',
  );
});

test('operator can restore an out-of-service compartment', () => {
  const { mappers } = harness();

  assert.equal(
    mappers.getCompartmentStatusAction({ operationalStatus: 'OutOfService' }, { operationalStatus: 'OutOfService' }),
    'restore',
  );
});

test('no status action on inactive lockers, matching the backend 400 rule', () => {
  const { mappers } = harness();

  for (const status of ['Operational', 'OutOfService', 'Inactive']) {
    assert.equal(
      mappers.getCompartmentStatusAction({ operationalStatus: 'Inactive' }, { operationalStatus: status }),
      null,
    );
  }
});

test('inactive or unknown compartments are left to the administrator', () => {
  const { mappers } = harness();

  assert.equal(
    mappers.getCompartmentStatusAction({ operationalStatus: 'Operational' }, { operationalStatus: 'Inactive' }),
    null,
  );
  assert.equal(
    mappers.getCompartmentStatusAction({ operationalStatus: 'Operational' }, { operationalStatus: 'Unknown' }),
    null,
  );
});

test('status request body contains only the backend contract fields', () => {
  const { mappers } = harness();

  assert.deepEqual(mappers.buildCompartmentStatusRequest('take-out-of-service'), { operationalStatus: 1 });
  assert.deepEqual(mappers.buildCompartmentStatusRequest('restore'), { operationalStatus: 0 });
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('assigned lockers come from GET /api/Lockers and are sorted by code', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return [summaryDto('LK-10'), summaryDto('LK-2')];
  });

  const result = await service.listAssignedLockers();

  assert.equal(calls[0].url, '/api/Lockers');
  assert.equal(calls[0].options.method, undefined);
  assert.deepEqual(result.map((item) => item.code), ['LK-2', 'LK-10']);
});

test('assigned lockers also accept a paged response', async () => {
  const { service } = harness(async () => ({ items: [summaryDto('LK-01')], totalCount: 1, pageNumber: 1, pageSize: 20 }));

  assert.deepEqual((await service.listAssignedLockers()).map((item) => item.code), ['LK-01']);
});

test('locker detail is read from GET /api/Lockers/{id} with an encoded id', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return detailDto([compartmentDto('A1')]);
  });

  const result = await service.getLockerDetail('id/with space');

  assert.equal(calls[0], '/api/Lockers/id%2Fwith%20space');
  assert.equal(result.compartments.length, 1);
});

test('status change PUTs the numeric status to the compartment endpoint', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return compartmentDto('A1', { operationalStatus: 1 });
  });

  const result = await service.updateCompartmentStatus('locker-1', 'comp-1', 'take-out-of-service');

  assert.equal(calls[0].url, '/api/Lockers/locker-1/compartments/comp-1/status');
  assert.equal(calls[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body), { operationalStatus: 1 });
  assert.equal(result.operationalStatus, 'OutOfService');
});

test('locker history queries operational records by locker with a page size', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return {
      items: [{ kind: 'LockerCompartment', id: 'r1', code: 'A1', status: 'Operational', lockerCode: 'LK-01', summary: 'HW', occurredAt: '2026-10-14T07:00:00Z' }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 20,
    };
  });

  const result = await service.getLockerHistory('locker-1');
  const url = new URL(calls[0], 'http://test');

  assert.equal(url.pathname, '/api/operational-records');
  assert.equal(url.searchParams.get('lockerId'), 'locker-1');
  assert.equal(url.searchParams.get('pageNumber'), '1');
  assert.equal(url.searchParams.get('pageSize'), '20');
  assert.deepEqual(result[0], { kind: 'LockerCompartment', id: 'r1', code: 'A1', status: 'Operational', summary: 'HW', occurredAt: '2026-10-14T07:00:00Z' });
});

// ---------------------------------------------------------------------------
// Vietnamese messages and labels
// ---------------------------------------------------------------------------

test('load errors are Vietnamese and distinguish scope from missing lockers', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getLockerLoadErrorMessage(new ApiError(status, 'raw'));

  assert.equal(message(403), 'Tủ này không thuộc phạm vi bạn được phân công.');
  assert.equal(message(404), 'Không tìm thấy tủ hoặc tủ đã bị gỡ khỏi phạm vi phụ trách.');
  assert.equal(message(0), 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  assert.equal(message(500), 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
  assert.equal(service.getLockerLoadErrorMessage(new Error('boom')), 'Không thể tải dữ liệu tủ. Vui lòng thử lại.');
});

test('status change errors cover 400, 403, 404, 409 and transport failures', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getCompartmentStatusErrorMessage(new ApiError(status, 'raw'));

  assert.equal(message(400), 'Không thể cập nhật trạng thái: tủ đã bị vô hiệu hóa hoặc trạng thái không hợp lệ.');
  assert.equal(message(403), 'Tủ này không thuộc phạm vi bạn được phân công.');
  assert.equal(message(404), 'Không tìm thấy ngăn tủ. Dữ liệu có thể đã thay đổi, vui lòng tải lại.');
  assert.equal(message(409), 'Trạng thái ngăn đã thay đổi bởi người khác. Vui lòng tải lại.');
  assert.equal(message(429), 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
  assert.equal(service.getCompartmentStatusErrorMessage(undefined), 'Không thể cập nhật trạng thái ngăn. Vui lòng thử lại.');
});

test('every status has a Vietnamese label', () => {
  const { constants } = harness();

  for (const status of ['Operational', 'OutOfService', 'Inactive', 'Unknown']) {
    assert.ok(constants.LOCKER_OPERATIONAL_STATUS_DISPLAY[status].label);
    assert.ok(constants.COMPARTMENT_OPERATIONAL_STATUS_DISPLAY[status].label);
  }
  for (const status of ['Online', 'Offline', 'Unknown']) {
    assert.ok(constants.CONNECTION_STATUS_DISPLAY[status].label);
  }
  for (const status of ['Open', 'Closed', 'Unknown']) {
    assert.ok(constants.DOOR_STATUS_DISPLAY[status].label);
  }
});

test('operational record kinds and statuses are translated', () => {
  const { records } = harness();

  assert.equal(records.formatOperationalRecordKind('LockerCompartment'), 'Ngăn tủ');
  assert.equal(records.formatOperationalRecordKind('Incident'), 'Sự cố');
  assert.equal(records.formatOperationalRecordStatus('LockerCompartment', 'OutOfService'), 'Ngừng phục vụ');
  assert.equal(records.formatOperationalRecordStatus('Parcel', 'Overdue'), 'Quá hạn');
  assert.equal(records.formatOperationalRecordStatus('LockerEvent', 'DeviceAlert'), 'Cảnh báo thiết bị');
  assert.equal(records.formatOperationalRecordStatus('MaintenanceRequest', 'InProgress'), 'Đang xử lý');
});

test('unknown record kinds and statuses never leak English text', () => {
  const { records } = harness();

  assert.equal(records.formatOperationalRecordKind('NewKind'), 'Không xác định');
  assert.equal(records.formatOperationalRecordStatus('Parcel', 'NewStatus'), 'Không xác định');
  assert.equal(records.formatOperationalRecordStatus('NewKind', 'Operational'), 'Không xác định');
});
