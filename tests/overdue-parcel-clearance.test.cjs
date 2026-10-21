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
    if (name !== '@/constants/error-codes') assert.equal(name, '@/services/overdue-parcel-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/overdue-parcel-service'), ApiError };
}

const parcelDto = (code, overrides = {}) => ({
  id: `id-${code}`,
  parcelCode: code,
  status: 'Overdue',
  lockerId: 'locker-1',
  lockerCode: 'LK-01',
  lockerAddress: 'Địa chỉ',
  compartmentId: 'c-1',
  compartmentCode: 'A01',
  storedAt: '2026-10-01T00:00:00Z',
  pickupDueAt: '2026-10-03T00:00:00Z',
  maxStorageUntil: '2026-10-08T00:00:00Z',
  retrievedAt: null,
  removedAt: null,
  overdueAmount: null,
  currency: null,
  overdueChargeStatus: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

test('string statuses from the parcel endpoints are mapped', () => {
  const { service } = harness();

  for (const status of ['Stored', 'Overdue', 'Retrieved', 'Removed']) {
    assert.equal(service.toParcelStatus(status), status);
  }
});

test('numeric statuses are accepted in backend enum order', () => {
  const { service } = harness();

  assert.deepEqual([0, 1, 2, 3].map(service.toParcelStatus), ['Stored', 'Overdue', 'Retrieved', 'Removed']);
});

test('unknown statuses fall back to Unknown', () => {
  const { service } = harness();

  for (const value of ['Lost', 9, null]) assert.equal(service.toParcelStatus(value), 'Unknown');
});

test('overdue charge status is optional', () => {
  const { service } = harness();

  assert.equal(service.toOverdueChargeStatus(null), null);
  assert.equal(service.toOverdueChargeStatus('Paid'), 'Paid');
  assert.equal(service.toOverdueChargeStatus('Outstanding'), 'Outstanding');
  assert.equal(service.toOverdueChargeStatus('Refunded'), 'Unknown');
});

test('every status has a Vietnamese label', () => {
  const { service } = harness();

  for (const status of ['Stored', 'Overdue', 'Retrieved', 'Removed', 'Unknown']) {
    assert.ok(service.PARCEL_STATUS_DISPLAY[status].label);
  }
  assert.equal(service.PARCEL_STATUS_DISPLAY.Removed.label, 'Đã chuyển điểm tập kết');
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

test('time past the deadline is shown in days and hours', () => {
  const { service } = harness();
  const now = new Date('2026-10-10T05:30:00Z');

  assert.equal(service.formatTimePastDeadline('2026-10-08T00:00:00Z', now), '2 ngày 5 giờ');
  assert.equal(service.formatTimePastDeadline('2026-10-07T05:00:00Z', now), '3 ngày');
  assert.equal(service.formatTimePastDeadline('2026-10-10T01:00:00Z', now), '4 giờ');
  assert.equal(service.formatTimePastDeadline('2026-10-10T05:10:00Z', now), 'Dưới 1 giờ');
});

test('a deadline in the future or invalid never shows a negative duration', () => {
  const { service } = harness();
  const now = new Date('2026-10-10T00:00:00Z');

  assert.equal(service.formatTimePastDeadline('2026-10-12T00:00:00Z', now), 'Dưới 1 giờ');
  assert.equal(service.formatTimePastDeadline('not-a-date', now), 'Không xác định');
});

test('overdue amount uses vi-VN currency formatting', () => {
  const { service } = harness();
  const expected = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(25000);

  assert.equal(service.formatOverdueAmount(25000, 'VND'), expected);
  assert.equal(service.formatOverdueAmount(25000, null), expected);
  assert.equal(service.formatOverdueAmount(null, 'VND'), 'Chưa phát sinh');
});

test('queue lockers are distinct and sorted naturally', () => {
  const { service } = harness();
  const parcels = [
    { lockerId: 'b', lockerCode: 'LK-10' },
    { lockerId: 'a', lockerCode: 'LK-2' },
    { lockerId: 'b', lockerCode: 'LK-10' },
  ];

  assert.deepEqual(service.getQueueLockers(parcels), [
    { id: 'a', code: 'LK-2' },
    { id: 'b', code: 'LK-10' },
  ]);
});

test('filter matches parcel, locker and compartment codes and the locker filter', () => {
  const { service } = harness();
  const parcels = [
    { id: '1', parcelCode: 'PKG-001', lockerId: 'a', lockerCode: 'LK-01', compartmentCode: 'A01' },
    { id: '2', parcelCode: 'PKG-002', lockerId: 'b', lockerCode: 'LK-02', compartmentCode: 'B07' },
  ];
  const ids = (keyword, locker = 'all') => service.filterOverdueParcels(parcels, keyword, locker).map((p) => p.id);

  assert.deepEqual(ids(''), ['1', '2']);
  assert.deepEqual(ids('pkg-002'), ['2']);
  assert.deepEqual(ids('lk-01'), ['1']);
  assert.deepEqual(ids('b07'), ['2']);
  assert.deepEqual(ids('', 'a'), ['1']);
  assert.deepEqual(ids('PKG-002', 'a'), []);
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('queue uses view=ClearancePending (the backend has no "Overdue" view)', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return [
      parcelDto('PKG-2', { maxStorageUntil: '2026-10-09T00:00:00Z' }),
      parcelDto('PKG-1', { maxStorageUntil: '2026-10-05T00:00:00Z' }),
    ];
  });

  const result = await service.listClearancePendingParcels();

  assert.equal(calls[0], '/api/parcels?view=ClearancePending');
  assert.deepEqual(result.map((p) => p.parcelCode), ['PKG-1', 'PKG-2'], 'oldest deadline first');
});

test('detail maps recovery address and shipper fields', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return {
      ...parcelDto('PKG-1'),
      lockerRecoveryAddress: 'Phòng bảo vệ',
      parcelImageUrl: null,
      shipperName: 'Shipper A',
      shipperPhone: '0900000000',
    };
  });

  const detail = await service.getOverdueParcelDetail('id-PKG-1');

  assert.equal(calls[0], '/api/parcels/id-PKG-1');
  assert.equal(detail.recoveryAddress, 'Phòng bảo vệ');
  assert.equal(detail.shipperName, 'Shipper A');
});

test('transfer POSTs to the collection point action without a body', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return { parcelId: 'id-1', parcelCode: 'PKG-1', collectionAddress: 'Phòng bảo vệ', status: 'Removed' };
  });

  const result = await service.transferToCollectionPoint('id-1');

  assert.equal(calls[0].url, '/api/parcels/id-1:transferToCollectionPoint');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body, undefined);
  assert.deepEqual(result, { parcelId: 'id-1', parcelCode: 'PKG-1', collectionAddress: 'Phòng bảo vệ', status: 'Removed' });
});

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

test('transfer errors explain eligibility conflicts and scope', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getTransferErrorMessage(new ApiError(status, 'raw'));

  assert.match(message(409), /chưa đủ điều kiện/);
  assert.equal(message(403), 'Bưu kiện này không thuộc tủ bạn được phân công.');
  assert.match(message(404), /đã được xử lý/);
  assert.match(message(0), /Không thể kết nối/);
  assert.equal(service.getTransferErrorMessage(new Error('x')), 'Không thể chuyển bưu kiện. Vui lòng thử lại.');
});

test('load errors never leak raw English text', () => {
  const { service, ApiError } = harness();

  assert.match(service.getOverdueLoadErrorMessage(new ApiError(500, 'boom')), /Máy chủ đang gặp sự cố/);
  assert.equal(
    service.getOverdueLoadErrorMessage(new ApiError(400, 'Parcel view is invalid.')),
    'Không thể tải danh sách bưu kiện quá hạn. Vui lòng thử lại.',
  );
});
