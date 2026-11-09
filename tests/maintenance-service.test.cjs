const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function harness() {
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
    if (name === '@/services/api-client') return { ApiError };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/services/maintenance-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/maintenance-service'), ApiError };
}

test('the request targets the chosen locker and compartment, never the first locker (#90)', () => {
  const { service } = harness();
  const values = { ...service.emptyMaintenanceForm({ lockerId: 'locker-B' }), compartmentId: 'cmp-3', priority: 2, description: '  Cửa kẹt ' };

  assert.deepEqual(service.buildCreateMaintenanceRequest(values), {
    lockerId: 'locker-B', compartmentId: 'cmp-3', incidentId: null, priority: 2, description: 'Cửa kẹt',
  });
  assert.equal(service.buildCreateMaintenanceRequest({ ...values, compartmentId: '' }).compartmentId, null);
});

test('changing the locker drops the previous compartment and incident', () => {
  const { service } = harness();
  const values = { ...service.emptyMaintenanceForm({ lockerId: 'A', compartmentId: 'a1', incidentId: 'i1' }), description: 'x' };
  const next = service.changeMaintenanceLocker(values, 'B');

  assert.equal(next.lockerId, 'B');
  assert.equal(next.compartmentId, '');
  assert.equal(next.incidentId, '');
  assert.equal(next.description, 'x');
  assert.equal(service.changeMaintenanceLocker(values, 'A'), values);
});

test('validation requires a locker and a description', () => {
  const { service } = harness();

  assert.deepEqual(Object.keys(service.validateMaintenanceForm(service.emptyMaintenanceForm())).sort(), ['description', 'lockerId']);
  assert.deepEqual(service.validateMaintenanceForm({ ...service.emptyMaintenanceForm({ lockerId: 'A' }), description: 'Lỗi' }), {});
  assert.ok(service.validateMaintenanceForm({ ...service.emptyMaintenanceForm({ lockerId: 'A' }), description: 'x'.repeat(1001) }).description);
});

test('target summary and context links', () => {
  const { service } = harness();

  assert.equal(service.describeMaintenanceTarget(undefined, undefined), 'Chưa chọn tủ');
  assert.equal(service.describeMaintenanceTarget('LK-01', undefined), 'Tủ LK-01 · bảo trì cả tủ');
  assert.equal(service.describeMaintenanceTarget('LK-01', 'A03'), 'Tủ LK-01 · ngăn A03');
  assert.equal(service.maintenanceFormHref({ lockerId: 'l 1', compartmentId: 'c1', incidentId: null }), '/operator/maintenance?lockerId=l+1&compartmentId=c1');
});

test('errors map by backend code', () => {
  const { service, ApiError } = harness();
  const message = (status, code, errors) => service.getMaintenanceErrorMessage(new ApiError(status, 'x', code, errors));

  assert.match(message(404, 'locker/invalid_compartment'), /Ngăn không thuộc tủ/);
  assert.match(message(403, 'locker/access_denied'), /phạm vi/);
  assert.match(message(409, 'maintenance/invalid_request'), /đã đóng hoặc đã hủy/);
  assert.match(message(400, 'maintenance/invalid_request'), /Sự cố liên kết/);
  assert.match(message(400, 'validation/invalid_input', { result: ['x'] }), /kết quả xử lý/);
});
