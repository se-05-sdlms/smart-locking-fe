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
      '@/constants/emergency-unlock',
      '@/services/emergency-unlock-service',
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
    service: load('@/services/emergency-unlock-service'),
    constants: load('@/constants/emergency-unlock'),
    ApiError,
  };
}

const responseDto = (overrides = {}) => ({
  id: 'unlock-1',
  result: 1,
  compartmentCode: 'A01',
  requestedAt: '2026-10-14T08:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Reason validation
// ---------------------------------------------------------------------------

test('reason minimum length mirrors the backend rule (10 trimmed characters)', () => {
  const { service, constants } = harness();

  assert.equal(constants.EMERGENCY_REASON_MIN_LENGTH, 10);
  assert.equal(service.validateEmergencyReason('123456789'), 'Lý do phải có ít nhất 10 ký tự.');
  assert.equal(service.validateEmergencyReason('1234567890'), undefined);
});

test('reason is trimmed before the length check, like the backend', () => {
  const { service } = harness();

  assert.equal(service.validateEmergencyReason('   123456789   '), 'Lý do phải có ít nhất 10 ký tự.');
  assert.equal(service.validateEmergencyReason('  1234567890  '), undefined);
});

test('empty or whitespace-only reason is required', () => {
  const { service } = harness();

  assert.equal(service.validateEmergencyReason(''), 'Vui lòng nhập lý do mở khẩn cấp.');
  assert.equal(service.validateEmergencyReason('      '), 'Vui lòng nhập lý do mở khẩn cấp.');
});

test('reason longer than the maximum is rejected', () => {
  const { service } = harness();

  assert.equal(service.validateEmergencyReason('a'.repeat(500)), undefined);
  assert.equal(service.validateEmergencyReason('a'.repeat(501)), 'Lý do không được vượt quá 500 ký tự.');
});

// ---------------------------------------------------------------------------
// Blockers (backend LockerAccessService.GetBlockedReason)
// ---------------------------------------------------------------------------

const ready = { operationalStatus: 'Operational', connectionStatus: 'Online' };

test('no blockers for an operational online locker and operational compartment', () => {
  const { service } = harness();

  assert.deepEqual(service.getEmergencyUnlockBlockers(ready, { operationalStatus: 'Operational' }), []);
});

test('offline or unknown connection blocks the unlock', () => {
  const { service } = harness();

  for (const connectionStatus of ['Offline', 'Unknown']) {
    assert.deepEqual(
      service.getEmergencyUnlockBlockers({ ...ready, connectionStatus }, { operationalStatus: 'Operational' }),
      ['locker-not-online'],
    );
  }
});

test('locker that is out of service or inactive blocks the unlock', () => {
  const { service } = harness();

  for (const operationalStatus of ['OutOfService', 'Inactive']) {
    assert.deepEqual(
      service.getEmergencyUnlockBlockers({ ...ready, operationalStatus }, { operationalStatus: 'Operational' }),
      ['locker-not-operational'],
    );
  }
});

test('compartment that is not operational blocks the unlock', () => {
  const { service } = harness();

  for (const operationalStatus of ['OutOfService', 'Inactive', 'Unknown']) {
    assert.deepEqual(
      service.getEmergencyUnlockBlockers(ready, { operationalStatus }),
      ['compartment-not-operational'],
    );
  }
});

test('all blockers are reported together', () => {
  const { service } = harness();

  assert.deepEqual(
    service.getEmergencyUnlockBlockers(
      { operationalStatus: 'OutOfService', connectionStatus: 'Offline' },
      { operationalStatus: 'OutOfService' },
    ),
    ['locker-not-operational', 'locker-not-online', 'compartment-not-operational'],
  );
});

test('every blocker has Vietnamese text', () => {
  const { constants } = harness();

  for (const blocker of ['locker-not-operational', 'locker-not-online', 'compartment-not-operational']) {
    assert.ok(constants.EMERGENCY_UNLOCK_BLOCKER_TEXT[blocker]);
  }
});

// ---------------------------------------------------------------------------
// Result mapping
// ---------------------------------------------------------------------------

test('numeric results map in backend enum order', () => {
  const { service } = harness();

  assert.deepEqual([0, 1, 2].map(service.toEmergencyUnlockResult), ['Pending', 'Succeeded', 'Failed']);
});

test('string results are accepted for a future JsonStringEnumConverter', () => {
  const { service } = harness();

  assert.equal(service.toEmergencyUnlockResult('Succeeded'), 'Succeeded');
  assert.equal(service.toEmergencyUnlockResult('Pending'), 'Pending');
});

test('unknown results are treated as Failed, never as success', () => {
  const { service } = harness();

  for (const value of [3, -1, 'Opened', null, undefined]) {
    assert.equal(service.toEmergencyUnlockResult(value), 'Failed');
  }
});

test('every result has a Vietnamese label and description', () => {
  const { constants } = harness();

  for (const result of ['Pending', 'Succeeded', 'Failed']) {
    assert.ok(constants.EMERGENCY_UNLOCK_RESULT_DISPLAY[result].label);
    assert.ok(constants.EMERGENCY_UNLOCK_RESULT_DISPLAY[result].description);
  }
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('request body matches the backend DTO and trims the reason', () => {
  const { service } = harness();

  assert.deepEqual(service.buildEmergencyUnlockRequest('locker-1', 'comp-1', '  Cửa ngăn bị kẹt  '), {
    lockerId: 'locker-1',
    compartmentId: 'comp-1',
    incidentId: null,
    reason: 'Cửa ngăn bị kẹt',
  });
});

test('create POSTs to /api/emergency-unlocks and maps the server result', async () => {
  const calls = [];
  const { service } = harness(async (url, options) => {
    calls.push({ url, options });
    return responseDto({ result: 2 });
  });

  const result = await service.createEmergencyUnlock('locker-1', 'comp-1', 'Cửa ngăn bị kẹt cứng');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/emergency-unlocks');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.auth, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    lockerId: 'locker-1',
    compartmentId: 'comp-1',
    incidentId: null,
    reason: 'Cửa ngăn bị kẹt cứng',
  });
  assert.deepEqual(result, {
    id: 'unlock-1',
    result: 'Failed',
    compartmentCode: 'A01',
    requestedAt: '2026-10-14T08:00:00Z',
  });
});

test('backend errors propagate to the dialog', async () => {
  const { service, ApiError } = harness(async () => {
    throw new ApiError(403, 'Tủ không thuộc phạm vi vận hành.');
  });

  await assert.rejects(
    service.createEmergencyUnlock('locker-1', 'comp-1', 'Cửa ngăn bị kẹt cứng'),
    (error) => error.status === 403,
  );
});

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

test('error messages cover validation, scope, missing compartment and conflicts', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getEmergencyUnlockErrorMessage(new ApiError(status, 'raw'));

  assert.match(message(400), /tối thiểu 10 ký tự/);
  assert.equal(message(401), 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  assert.equal(message(403), 'Tủ này không thuộc phạm vi bạn được phân công.');
  assert.match(message(404), /Không tìm thấy ngăn tủ/);
  assert.match(message(409), /Trạng thái tủ đã thay đổi/);
  assert.match(message(429), /quá nhanh/);
});

test('timeouts and server errors warn against a blind retry', () => {
  const { service, ApiError } = harness();
  const message = (status) => service.getEmergencyUnlockErrorMessage(new ApiError(status, 'raw'));

  assert.match(message(408), /Lịch sử vận hành/);
  assert.match(message(500), /Lịch sử vận hành/);
  assert.match(message(503), /Lịch sử vận hành/);
});

test('connection failure says the command was not sent', () => {
  const { service, ApiError } = harness();

  assert.match(service.getEmergencyUnlockErrorMessage(new ApiError(0, '')), /chưa được gửi/);
});

test('unknown errors never leak raw English text', () => {
  const { service } = harness();

  assert.equal(service.getEmergencyUnlockErrorMessage(new Error('boom')), 'Không thể mở khẩn cấp. Vui lòng thử lại.');
  assert.equal(service.getEmergencyUnlockErrorMessage(undefined), 'Không thể mở khẩn cấp. Vui lòng thử lại.');
});
