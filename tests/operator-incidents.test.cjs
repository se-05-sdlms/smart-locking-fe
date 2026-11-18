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
    assert.ok(['@/constants/incident', '@/services/incident-service'].includes(name));
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
    service: load('@/services/incident-service'),
    constants: load('@/constants/incident'),
    ApiError,
  };
}

const listItemDto = (overrides = {}) => ({
  id: 'inc-1',
  type: 'Compartment',
  source: 2,
  status: 0,
  title: 'Ngăn A01 không mở được',
  lockerId: 'locker-1',
  lockerCode: 'LK-01',
  lockerAddress: 'Địa chỉ',
  parcelId: null,
  parcelCode: null,
  returnRequestId: null,
  returnCode: null,
  paymentTransactionId: null,
  assignedOperatorUserId: 'op-1',
  createdAt: '2026-10-14T08:00:00Z',
  updatedAt: '2026-10-14T08:00:00Z',
  ...overrides,
});

const actionDto = (id, createdAt, overrides = {}) => ({
  id,
  actionByUserId: 'u',
  actionByName: 'Nhân viên',
  actionType: 'NoteAdded',
  fromStatus: null,
  toStatus: null,
  notes: 'Ghi chú',
  createdAt,
  ...overrides,
});

const detailDto = (overrides = {}) => ({
  ...listItemDto(),
  description: 'Mô tả',
  evidenceUrl: null,
  lockerCompartmentId: null,
  lockerCompartmentCode: 'A01',
  assignedOperatorName: 'Nhân viên',
  resolutionSummary: null,
  escalatedAt: null,
  resolvedAt: null,
  actions: [
    actionDto('a1', '2026-10-14T08:00:00Z', { actionType: 'Created', toStatus: 0, notes: null }),
    actionDto('a2', '2026-10-14T09:00:00Z'),
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Enum mapping and labels
// ---------------------------------------------------------------------------

test('numeric statuses and sources map in backend enum order', () => {
  const { service } = harness();

  assert.deepEqual([0, 1, 2, 3].map(service.toIncidentStatus), ['Open', 'Investigating', 'Resolved', 'Escalated']);
  assert.deepEqual([0, 1, 2, 3].map(service.toIncidentSource), ['Resident', 'Shipper', 'Guest', 'System']);
});

test('string enum names are accepted and unknown values fall back to Unknown', () => {
  const { service } = harness();

  assert.equal(service.toIncidentStatus('Escalated'), 'Escalated');
  assert.equal(service.toIncidentSource('Guest'), 'Guest');
  for (const value of [4, -1, 'Closed', null]) {
    assert.equal(service.toIncidentStatus(value), 'Unknown');
    assert.equal(service.toIncidentSource(value), 'Unknown');
  }
});

test('transition names map back to backend numbers', () => {
  const { service } = harness();

  assert.equal(service.toIncidentStatusDto('Investigating'), 1);
  assert.equal(service.toIncidentStatusDto('Resolved'), 2);
  assert.equal(service.toIncidentStatusDto('Escalated'), 3);
});

test('incident types and action types are translated, unknown ones never leak English', () => {
  const { service } = harness();

  assert.equal(service.formatIncidentType('Compartment'), 'Ngăn tủ');
  assert.equal(service.formatIncidentType('Payment'), 'Thanh toán');
  assert.equal(service.formatIncidentType('Weird'), 'Không xác định');
  assert.equal(service.formatIncidentActionType('StatusChanged'), 'Đổi trạng thái');
  assert.equal(service.formatIncidentActionType('Created'), 'Tạo sự cố');
  assert.equal(service.formatIncidentActionType('Other'), 'Không xác định');
});

test('every backend incident type has a Vietnamese label', () => {
  const { constants } = harness();

  for (const type of ['Locker', 'Compartment', 'Parcel', 'Retrieval', 'Return', 'Payment', 'Other']) {
    assert.ok(constants.INCIDENT_TYPE_LABELS[type], type);
  }
});

// ---------------------------------------------------------------------------
// DTO -> view model
// ---------------------------------------------------------------------------

test('list item maps statuses and keeps related codes', () => {
  const { service } = harness();
  const item = service.mapIncidentListItem(listItemDto({ status: 1, parcelCode: 'P-1' }));

  assert.equal(item.status, 'Investigating');
  assert.equal(item.source, 'Guest');
  assert.equal(item.parcelCode, 'P-1');
});

test('detail timeline is newest first and maps action statuses', () => {
  const { service } = harness();
  const detail = service.mapIncidentDetail(detailDto());

  assert.deepEqual(detail.actions.map((action) => action.id), ['a2', 'a1']);
  assert.equal(detail.actions[1].toStatus, 'Open');
  assert.equal(detail.actions[0].toStatus, null);
  assert.equal(detail.lockerCompartmentCode, 'A01');
});

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

test('operator transitions follow IncidentService.IsValidTransition', () => {
  const { service } = harness();

  assert.deepEqual(service.getOperatorTransitions('Open'), ['Investigating', 'Escalated']);
  assert.deepEqual(service.getOperatorTransitions('Investigating'), ['Resolved', 'Escalated']);
});

test('escalated and resolved incidents offer no operator transition', () => {
  const { service } = harness();

  assert.deepEqual(service.getOperatorTransitions('Escalated'), []);
  assert.deepEqual(service.getOperatorTransitions('Resolved'), []);
  assert.deepEqual(service.getOperatorTransitions('Unknown'), []);
});

test('actions can be added until the incident is resolved', () => {
  const { service } = harness();

  assert.equal(service.canAddIncidentAction('Open'), true);
  assert.equal(service.canAddIncidentAction('Investigating'), true);
  assert.equal(service.canAddIncidentAction('Escalated'), true);
  assert.equal(service.canAddIncidentAction('Resolved'), false);
  assert.equal(service.canAddIncidentAction('Unknown'), false);
});

test('text validation enforces required content and the 4000 character limit', () => {
  const { service } = harness();

  assert.equal(service.validateIncidentText('   ', true), 'Vui lòng nhập nội dung.');
  assert.equal(service.validateIncidentText('', false), undefined);
  assert.equal(service.validateIncidentText('a'.repeat(4000), true), undefined);
  assert.equal(service.validateIncidentText('a'.repeat(4001), false), 'Nội dung không được vượt quá 4000 ký tự.');
});

test('resolving sends resolutionSummary, other transitions send notes', () => {
  const { service } = harness();

  assert.deepEqual(service.buildIncidentStatusRequest('Resolved', '  Đã thay lò xo cửa  '), {
    status: 2,
    notes: null,
    resolutionSummary: 'Đã thay lò xo cửa',
  });
  assert.deepEqual(service.buildIncidentStatusRequest('Escalated', 'Cần thay bo mạch'), {
    status: 3,
    notes: 'Cần thay bo mạch',
    resolutionSummary: null,
  });
  assert.deepEqual(service.buildIncidentStatusRequest('Investigating', '   '), {
    status: 1,
    notes: null,
    resolutionSummary: null,
  });
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('list calls /api/operator/incidents without a filter for "all"', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return [listItemDto()];
  });

  const result = await service.listOperatorIncidents('all');

  assert.equal(calls[0], '/api/operator/incidents');
  assert.equal(result[0].status, 'Open');
});

test('list passes the status filter by enum name', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return [];
  });

  await service.listOperatorIncidents('Investigating');

  assert.equal(calls[0], '/api/operator/incidents?status=Investigating');
});

test('detail is read from /api/incidents/{id}', async () => {
  const calls = [];
  const { service } = harness(async (url) => {
    calls.push(url);
    return detailDto();
  });

  await service.getIncidentDetail('inc 1');

  assert.equal(calls[0], '/api/incidents/inc%201');
});

test('adding an action POSTs trimmed notes', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return detailDto();
  });

  await service.addIncidentAction('inc-1', '  Đã kiểm tra tại chỗ  ');

  assert.equal(calls[0].url, '/api/operator/incidents/inc-1/actions');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { notes: 'Đã kiểm tra tại chỗ' });
});

test('status change PATCHes the numeric status with the right text field', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return detailDto({ status: 2 });
  });

  const result = await service.updateIncidentStatus('inc-1', 'Resolved', 'Đã xử lý xong');

  assert.equal(calls[0].url, '/api/operator/incidents/inc-1/status');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    status: 2,
    notes: null,
    resolutionSummary: 'Đã xử lý xong',
  });
  assert.equal(result.status, 'Resolved');
});

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

test('load errors are Vietnamese', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getIncidentLoadErrorMessage(new ApiError(status, 'raw'));

  assert.equal(message(403), 'Sự cố này không thuộc tủ bạn được phân công.');
  assert.match(message(404), /Không tìm thấy sự cố/);
  assert.match(message(0), /Không thể kết nối/);
  assert.match(message(500), /Máy chủ đang gặp sự cố/);
  assert.equal(service.getIncidentLoadErrorMessage(new Error('x')), 'Không thể tải dữ liệu sự cố. Vui lòng thử lại.');
});

test('mutation errors explain 400 and 409 from the backend', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getIncidentMutationErrorMessage(new ApiError(status, 'Resolved incidents cannot receive new actions.'));

  assert.match(message(400), /kết quả xử lý hoặc lý do chuyển cấp/);
  assert.match(message(409), /Trạng thái sự cố đã thay đổi/);
  assert.match(message(429), /quá nhanh/);
  assert.equal(service.getIncidentMutationErrorMessage(undefined), 'Không thể cập nhật sự cố. Vui lòng thử lại.');
});
