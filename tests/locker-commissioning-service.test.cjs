const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function harness(request = async () => undefined) {
  class ApiError extends Error {
    constructor(status, message = '', code, errors) {
      super(message);
      this.status = status;
      this.code = code;
      this.errors = errors;
    }
  }
  const cache = new Map();
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/services/locker-commissioning-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/locker-commissioning-service'), ApiError };
}

const state = (overrides = {}) => ({ lockerId: 'l-1', isLegacyLocker: false, stage: 0, revision: 3, deviceIdentifier: 'ESP-1', boundDeviceIdentifier: null, firmwareVersion: null, firmwareHardwareModel: null, configuredAt: null, verifiedAt: null, verifiedByUserId: null, handedOverAt: null, handedOverByUserId: null, firmwareRelease: null, blockers: [], history: [], ...overrides });

test('progress is derived from what the server recorded', () => {
  const { service } = harness();

  assert.equal(service.currentStep(state()), 'bind');
  assert.equal(service.currentStep(state({ boundDeviceIdentifier: 'ESP-1' })), 'configure');
  assert.equal(service.currentStep(state({ boundDeviceIdentifier: 'ESP-1', configuredAt: 'x' })), 'verify');
  assert.equal(service.currentStep(state({ configuredAt: 'x', verifiedAt: 'y' })), 'handover');
  assert.equal(service.currentStep(state({ handedOverAt: 'z' })), 'done');
  const mid = state({ boundDeviceIdentifier: 'ESP-1', configuredAt: 'x' });
  assert.deepEqual(service.STEPS.map((step) => service.stepStatus(mid, step.id)), ['done', 'done', 'current', 'todo']);
  assert.equal(service.historyLabel('Locker.Commissioning.DeviceBound'), 'Liên kết thiết bị');
});

test('server messages are translated, including joined blockers', () => {
  const { service, ApiError } = harness();

  assert.match(service.translateCommissioningMessage('Compartment A01 needs valid hardware mapping, operational status and a fresh closed-door observation after configuration.'), /Ngăn A01/);
  const joined = 'A fresh online device signal is required. Resolve outstanding incidents before handover.';
  assert.equal(service.splitServerMessage(joined).length, 2);
  assert.match(service.getCommissioningErrorMessage(new ApiError(409, joined, 'locker/not_operational')), /tín hiệu.*sự cố/);
  assert.ok(service.isStaleRevision(new ApiError(409, 'Commissioning has changed. Reload the latest progress before continuing.', 'locker/not_operational')));
  assert.ok(service.isSha256('a'.repeat(64)));
  assert.ok(!service.isSha256('xyz'));
});

test('each step sends the expected revision to its endpoint', async () => {
  const calls = [];
  const { service } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return {}; });
  const release = { version: '1.2.0', hardwareModel: 'ESP32-S3', downloadUrl: 'https://x', sha256: 'A'.repeat(64), installationGuideUrl: 'https://y' };

  await service.getCommissioning('l-1');
  await service.bindDevice(state(), ' ESP-1 ', ' ');
  await service.configureDevice(state(), release, ' ' + 'A'.repeat(64), true, 'ok');
  await service.verifyLocker(state(), true, true, '');
  await service.handOver(state(), true, '');
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET /api/admin/lockers/l-1/commissioning',
    'POST /api/admin/lockers/l-1/commissioning/bind-device',
    'POST /api/admin/lockers/l-1/commissioning/configure',
    'POST /api/admin/lockers/l-1/commissioning/verify',
    'POST /api/admin/lockers/l-1/commissioning/handover',
  ]);
  assert.deepEqual(calls[1].body, { expectedRevision: 3, deviceIdentifier: 'ESP-1', notes: null });
  assert.deepEqual(calls[2].body, { expectedRevision: 3, firmwareVersion: '1.2.0', hardwareModel: 'ESP32-S3', firmwareSha256: 'a'.repeat(64), installationAndNetworkConfirmed: true, notes: 'ok' });
  assert.deepEqual(calls[4].body, { expectedRevision: 3, acceptedForOperation: true, notes: null });
});
