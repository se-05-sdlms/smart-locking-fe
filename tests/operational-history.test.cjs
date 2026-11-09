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
    assert.ok(['@/constants/operational-record', '@/services/operational-record-service'].includes(name));
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
    service: load('@/services/operational-record-service'),
    constants: load('@/constants/operational-record'),
    ApiError,
  };
}

const filters = (overrides = {}) => ({
  query: '',
  lockerId: 'all',
  kind: 'all',
  fromDate: '',
  toDate: '',
  pageNumber: 1,
  pageSize: 20,
  ...overrides,
});

const localMidnight = (y, m, d) => new Date(y, m - 1, d).toISOString();

// ---------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------

test('default filters only send paging', () => {
  const { service } = harness();

  assert.equal(service.buildOperationalRecordQuery(filters()), 'pageNumber=1&pageSize=20');
});

test('all filters are sent with the backend parameter names', () => {
  const { service } = harness();
  const params = new URLSearchParams(
    service.buildOperationalRecordQuery(
      filters({ query: '  A01 ', lockerId: 'locker-1', kind: 'Incident', fromDate: '2026-10-01', toDate: '2026-10-14', pageNumber: 3 }),
    ),
  );

  assert.equal(params.get('query'), 'A01');
  assert.equal(params.get('lockerId'), 'locker-1');
  assert.equal(params.get('kind'), 'Incident');
  assert.equal(params.get('from'), localMidnight(2026, 10, 1));
  assert.equal(params.get('to'), localMidnight(2026, 10, 15), 'end date is inclusive (backend "to" is exclusive)');
  assert.equal(params.get('pageNumber'), '3');
});

test('invalid dates are ignored', () => {
  const { service } = harness();

  assert.deepEqual(service.toDateRange('', 'not-a-date'), { from: null, to: null });
});

test('date range must not be reversed', () => {
  const { service } = harness();

  assert.equal(service.validateDateRange('2026-10-14', '2026-10-01'), 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  assert.equal(service.validateDateRange('2026-10-01', '2026-10-01'), undefined);
  assert.equal(service.validateDateRange('', '2026-10-01'), undefined);
});

// ---------------------------------------------------------------------------
// Detail support and rows
// ---------------------------------------------------------------------------

test('detail is offered only for kinds the backend detail endpoint supports', () => {
  const { service } = harness();

  for (const kind of ['Parcel', 'Return', 'DeliveryRequest', 'Incident', 'MaintenanceRequest', 'LockerEvent']) {
    assert.equal(service.hasOperationalRecordDetail(kind), true, kind);
  }
  for (const kind of ['Locker', 'LockerCompartment', 'Unknown']) {
    assert.equal(service.hasOperationalRecordDetail(kind), false, kind);
  }
});

test('detail rows use Vietnamese labels, translate enums and format dates', () => {
  const { service } = harness();
  const rows = service.toDetailRows({
    priority: 'High',
    severity: 'Critical',
    type: 'Compartment',
    storedAt: '2026-10-05T13:18:33.2178050+00:00',
    description: 'Cửa kẹt',
    resolution: null,
    reason: '   ',
  });
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

  assert.equal(byKey.priority.label, 'Mức ưu tiên');
  assert.equal(byKey.priority.value, 'Cao');
  assert.equal(byKey.severity.value, 'Nghiêm trọng');
  assert.equal(byKey.type.value, 'Ngăn tủ');
  assert.equal(byKey.storedAt.label, 'Thời điểm gửi vào');
  assert.equal(byKey.storedAt.value, service.formatRecordDateTime('2026-10-05T13:18:33.2178050+00:00'));
  assert.equal(byKey.description.value, 'Cửa kẹt');
  assert.equal(byKey.resolution, undefined, 'empty values are hidden');
  assert.equal(byKey.reason, undefined, 'whitespace values are hidden');
});

test('unknown detail keys get a neutral Vietnamese label', () => {
  const { service } = harness();

  assert.deepEqual(service.toDetailRows({ newField: 'x' }), [
    { key: 'newField', label: 'Thông tin khác', value: 'x' },
  ]);
});

test('every filterable kind has a Vietnamese label', () => {
  const { constants } = harness();

  for (const kind of constants.OPERATIONAL_RECORD_KIND_FILTERS) {
    assert.notEqual(constants.formatOperationalRecordKind(kind), 'Không xác định', kind);
  }
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('search calls /api/operational-records and flags detail support', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return {
      items: [
        { kind: 'Incident', id: 'i1', code: 'INC', status: 'Open', lockerCode: 'LK', summary: 's', occurredAt: '2026-10-14T00:00:00Z' },
        { kind: 'LockerCompartment', id: 'c1', code: 'A01', status: 'Operational', lockerCode: 'LK', summary: 'hw', occurredAt: '2026-10-13T00:00:00Z' },
      ],
      totalCount: 2,
      pageNumber: 1,
      pageSize: 20,
    };
  });

  const page = await service.searchOperationalRecords(filters({ kind: 'Incident' }));

  assert.equal(calls[0], '/api/operational-records?kind=Incident&pageNumber=1&pageSize=20');
  assert.deepEqual(page.items.map((item) => item.hasDetail), [true, false]);
  assert.equal(page.totalCount, 2);
});

test('detail calls /api/operational-records/{kind}/{id}', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return {};
  });

  await service.getOperationalRecordDetail('Parcel', 'id 1');

  assert.equal(calls[0], '/api/operational-records/Parcel/id%201');
});

test('errors are Vietnamese and never leak English', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getOperationalRecordErrorMessage(new ApiError(status, 'Operational record kind is invalid.'));

  assert.match(message(400), /Bộ lọc không hợp lệ/);
  assert.equal(message(403), 'Tủ đã chọn không thuộc phạm vi bạn được phân công.');
  assert.match(message(404), /Không tìm thấy bản ghi/);
  assert.match(message(500), /Máy chủ đang gặp sự cố/);
  assert.equal(service.getOperationalRecordErrorMessage(new Error('x')), 'Không thể tải lịch sử vận hành. Vui lòng thử lại.');
});
