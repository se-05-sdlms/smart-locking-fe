const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS module (pure functions, type-only imports).
function load() {
  const filename = path.join(__dirname, '..', 'src', 'services', 'locker-realtime-events.ts');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(() => ({}), module, module.exports);
  return module.exports;
}

const service = load();
const event = (overrides = {}) => ({
  type: 'LockerConnectionChanged',
  entityId: 'l-1',
  lockerId: 'l-1',
  status: 'Offline',
  message: null,
  occurredAt: '2026-10-21T09:00:00Z',
  ...overrides,
});

test('hub payloads are validated before use', () => {
  assert.equal(service.parseRealtimeEvent(null), null);
  assert.equal(service.parseRealtimeEvent('text'), null);
  assert.equal(service.parseRealtimeEvent({ status: 'Offline' }), null);
  assert.deepEqual(
    service.parseRealtimeEvent({ type: 'LockerConnectionChanged', entityId: 'l-1', lockerId: 'l-1', status: 'Offline', message: '', occurredAt: 'x' }),
    { type: 'LockerConnectionChanged', entityId: 'l-1', lockerId: 'l-1', status: 'Offline', message: null, occurredAt: 'x' },
  );
  const noTime = service.parseRealtimeEvent({ type: 'LockerDoorChanged', status: 1 });
  assert.equal(noTime.status, '');
  assert.equal(noTime.lockerId, null);
  assert.ok(!Number.isNaN(Date.parse(noTime.occurredAt)));
});

test('connection changes become Vietnamese alerts naming the locker', () => {
  const offline = service.describeLockerAlert(event(), 'SEED-LKR-001');
  assert.equal(offline.tone, 'danger');
  assert.equal(offline.title, 'Tủ SEED-LKR-001 mất kết nối');
  assert.match(offline.description, /Mở khẩn cấp bị chặn/);

  const online = service.describeLockerAlert(event({ status: 'Online' }));
  assert.equal(online.tone, 'success');
  assert.equal(online.title, 'Một tủ đã kết nối lại');

  assert.equal(service.describeLockerAlert(event({ status: 'Unknown' })), null);
});

test('device alerts are warnings; door alerts get a specific hint; door changes stay silent', () => {
  const door = service.describeLockerAlert(event({ type: 'LockerDeviceAlert', status: 'Warning', message: 'Door open too long' }), 'LK-02');
  assert.equal(door.tone, 'warning');
  assert.equal(door.title, 'Cảnh báo thiết bị · Tủ LK-02');
  assert.match(door.description, /mở cửa quá thời gian/);

  const other = service.describeLockerAlert(event({ type: 'LockerDeviceAlert', status: 'Warning', message: 'Tamper detected' }));
  assert.match(other.description, /Thiết bị báo bất thường/);

  assert.equal(service.describeLockerAlert(event({ type: 'LockerDoorChanged', status: 'Closed' })), null);
});

test('emergency unlock is blocked for offline or non-operational lockers only', () => {
  const availability = (connectionStatus, operationalStatus = 'Operational') =>
    service.getEmergencyUnlockAvailability({ connectionStatus, operationalStatus });

  assert.deepEqual(availability('Online'), { allowed: true });
  // Unknown: monitoring may be off; the backend decides.
  assert.deepEqual(availability('Unknown'), { allowed: true });
  assert.equal(availability('Offline').allowed, false);
  assert.match(availability('Offline').reason, /ngoại tuyến/);
  assert.equal(availability('Online', 'OutOfService').allowed, false);
  assert.match(availability('Online', 'Inactive').reason, /không vận hành/);
});
