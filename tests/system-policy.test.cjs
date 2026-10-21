const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS module with a stubbed API boundary. No HTTP, session or secrets.
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
    assert.equal(name, '@/services/system-policy-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/system-policy-service'), ApiError };
}

const policyDto = (overrides = {}) => ({
  id: 'p1', version: 1, defaultApprovalMode: 1,
  guestSessionTimeoutMinutes: 15, manualApprovalTimeoutMinutes: 30, compartmentReservationMinutes: 10,
  overdueStartAfterHours: 168, overdueFeePerHour: 2000, currency: 'VND', maxStorageHours: 336,
  clearanceEligibilityAfterHours: 336, clearanceNoticeBeforeHours: 24, pickupReminderStartDay: 5,
  otpMaxAttempts: 5, otpLockoutMinutes: 15, enableOtp: true, enableRemoteUnlock: true, enableFaceRecognition: false,
  effectiveFrom: '2026-10-01T03:00:00Z', effectiveTo: null, isActive: true, createdAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

test('policy state distinguishes active, draft and expired versions', () => {
  const { service } = harness();

  assert.equal(service.mapSystemPolicy(policyDto()).state, 'active');
  assert.equal(service.mapSystemPolicy(policyDto({ isActive: false })).state, 'draft');
  assert.equal(service.mapSystemPolicy(policyDto({ isActive: false, effectiveTo: '2026-10-02T00:00:00Z' })).state, 'expired');
  assert.equal(service.mapSystemPolicy(policyDto()).defaultApprovalMode, 'Manual');
  assert.equal(service.mapSystemPolicy(policyDto({ defaultApprovalMode: 0 })).defaultApprovalMode, 'Auto');
});

test('form values copy the base policy; a new version starts now', () => {
  const { service } = harness();
  const now = new Date(2026, 9, 14, 9, 30);
  const values = service.toPolicyFormValues(service.mapSystemPolicy(policyDto()), now);

  assert.equal(values.overdueFeePerHour, '2000');
  assert.equal(values.defaultApprovalMode, 'Manual');
  assert.equal(values.effectiveFrom, '2026-10-14T09:30');
});

test('editing a draft keeps its own effective date', () => {
  const { service } = harness();
  const draft = service.mapSystemPolicy(policyDto({ isActive: false, effectiveFrom: new Date(2026, 10, 1, 8, 0).toISOString() }));

  assert.equal(service.toPolicyFormValues(draft).effectiveFrom, '2026-11-01T08:00');
});

// ---------------------------------------------------------------------------
// Validation (mirrors SystemPolicyService.Validate)
// ---------------------------------------------------------------------------

test('default form values are valid', () => {
  const { service } = harness();

  assert.deepEqual(service.validatePolicyForm(service.toPolicyFormValues()), {});
});

test('timeouts and OTP values must be positive integers', () => {
  const { service } = harness();
  const base = service.toPolicyFormValues();

  for (const key of ['guestSessionTimeoutMinutes', 'manualApprovalTimeoutMinutes', 'compartmentReservationMinutes', 'otpMaxAttempts', 'otpLockoutMinutes']) {
    for (const value of ['0', '-1', '1.5', '', 'abc']) {
      assert.ok(service.validatePolicyForm({ ...base, [key]: value })[key], `${key}=${value}`);
    }
  }
});

test('pickup reminder day must fall within the 14-day storage period', () => {
  const { service } = harness();
  const base = service.toPolicyFormValues();

  assert.equal(service.validatePolicyForm({ ...base, pickupReminderStartDay: '14' }).pickupReminderStartDay, undefined);
  assert.equal(service.validatePolicyForm({ ...base, pickupReminderStartDay: '15' }).pickupReminderStartDay, 'Ngày bắt đầu nhắc phải từ 1 đến 14.');
  assert.ok(service.validatePolicyForm({ ...base, pickupReminderStartDay: '0' }).pickupReminderStartDay);
});

test('fee must be non-negative with at most two decimals; currency is 3 letters', () => {
  const { service } = harness();
  const base = service.toPolicyFormValues();

  assert.equal(service.validatePolicyForm({ ...base, overdueFeePerHour: '0' }).overdueFeePerHour, undefined);
  assert.equal(service.validatePolicyForm({ ...base, overdueFeePerHour: '1500.5' }).overdueFeePerHour, undefined);
  assert.ok(service.validatePolicyForm({ ...base, overdueFeePerHour: '-1' }).overdueFeePerHour);
  assert.ok(service.validatePolicyForm({ ...base, overdueFeePerHour: '1.234' }).overdueFeePerHour);
  assert.ok(service.validatePolicyForm({ ...base, currency: 'VN' }).currency);
  assert.ok(service.validatePolicyForm({ ...base, currency: 'V1D' }).currency);
});

test('clearance hours accept zero but not negatives', () => {
  const { service } = harness();
  const base = service.toPolicyFormValues();

  assert.equal(service.validatePolicyForm({ ...base, clearanceNoticeBeforeHours: '0' }).clearanceNoticeBeforeHours, undefined);
  assert.ok(service.validatePolicyForm({ ...base, clearanceNoticeBeforeHours: '-2' }).clearanceNoticeBeforeHours);
});

test('effective date is required', () => {
  const { service } = harness();

  assert.ok(service.validatePolicyForm({ ...service.toPolicyFormValues(), effectiveFrom: '' }).effectiveFrom);
});

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

test('request fixes the 7+7 day storage timeline and converts types', () => {
  const { service } = harness();
  const values = { ...service.toPolicyFormValues(), currency: ' vnd ', overdueFeePerHour: '1500.5', defaultApprovalMode: 'Manual', effectiveFrom: '2026-10-14T09:30' };
  const body = service.buildPolicyRequest(values);

  assert.equal(body.overdueStartAfterHours, 168);
  assert.equal(body.maxStorageHours, 336);
  assert.equal(body.defaultApprovalMode, 1);
  assert.equal(body.currency, 'VND');
  assert.equal(body.overdueFeePerHour, 1500.5);
  assert.equal(body.effectiveFrom, new Date('2026-10-14T09:30').toISOString(), 'local time is sent as an absolute instant');
  assert.equal(typeof body.guestSessionTimeoutMinutes, 'number');
});

test('dirty state compares every field', () => {
  const { service } = harness();
  const initial = service.toPolicyFormValues();

  assert.equal(service.isPolicyFormDirty(initial, { ...initial }), false);
  assert.equal(service.isPolicyFormDirty(initial, { ...initial, enableOtp: !initial.enableOtp }), true);
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('API calls use the system-policies endpoints', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push(`${options?.method ?? 'GET'} ${url}`);
    if (url.startsWith('/api/system-policies?')) {
      return { items: [policyDto({ id: 'a', version: 1 }), policyDto({ id: 'b', version: 3, isActive: false })], totalCount: 2 };
    }
    return policyDto({ isActive: false });
  });

  const list = await service.listSystemPolicies();
  await service.createSystemPolicy(service.toPolicyFormValues());
  await service.updateSystemPolicy('b', service.toPolicyFormValues());
  await service.activateSystemPolicy('b');

  assert.deepEqual(list.map((p) => p.version), [3, 1], 'newest version first');
  assert.deepEqual(calls, [
    'GET /api/system-policies?pageNumber=1&pageSize=50',
    'POST /api/system-policies',
    'PATCH /api/system-policies/b',
    'POST /api/system-policies/b:activate',
  ]);
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

test('backend English validation messages are translated', () => {
  const { service, ApiError } = harness();
  const message = (text) => service.getSystemPolicyErrorMessage(new ApiError(400, text));

  assert.equal(message('Storage timeline must be 7 normal days followed by 7 overdue days.'), 'Thời gian lưu phải là 7 ngày thường và 7 ngày quá hạn.');
  assert.equal(message('Fee or currency is invalid.'), 'Phí quá hạn hoặc mã tiền tệ không hợp lệ.');
  assert.equal(message('OTP policy is invalid.'), 'Cấu hình OTP không hợp lệ.');
  assert.equal(message('Bad Request'), 'Cấu hình chính sách không hợp lệ.');
});

test('editing the active version (409) explains immutability', () => {
  const { service, ApiError } = harness();

  assert.match(service.getSystemPolicyErrorMessage(new ApiError(409, 'Conflict')), /không thể chỉnh sửa/);
  assert.equal(service.getSystemPolicyErrorMessage(undefined), 'Không thể xử lý chính sách. Vui lòng thử lại.');
});
