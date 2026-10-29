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
    assert.ok(['@/services/subscription-plan-service', '@/constants/error-codes'].includes(name));
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/subscription-plan-service'), ApiError };
}

const plan = (overrides = {}) => ({ id: 'p-1', code: 'MONTHLY', name: 'Gói tháng', description: null, price: 49000, durationDays: 30, maxActiveParcels: 5, isActive: true, ...overrides });

test('validation mirrors SubscriptionPlanService.Validate', () => {
  const { service } = harness();
  const values = (overrides = {}) => ({ ...service.emptyPlanForm(), code: 'MONTHLY', name: 'Gói tháng', price: '49000', maxActiveParcels: '5', ...overrides });

  assert.deepEqual(service.validatePlanForm(values(), 'create'), {});
  assert.ok(service.validatePlanForm(values({ code: '' }), 'create').code);
  assert.deepEqual(service.validatePlanForm(values({ code: '' }), 'edit'), {});
  assert.ok(service.validatePlanForm(values({ code: 'x'.repeat(51) }), 'create').code);
  assert.ok(service.validatePlanForm(values({ name: ' ' }), 'create').name);
  assert.ok(service.validatePlanForm(values({ price: '-1' }), 'create').price);
  assert.ok(service.validatePlanForm(values({ price: '1.5' }), 'create').price);
  assert.deepEqual(service.validatePlanForm(values({ price: '0' }), 'create'), {});
  assert.ok(service.validatePlanForm(values({ durationDays: '0' }), 'create').durationDays);
  assert.ok(service.validatePlanForm(values({ durationDays: '36501' }), 'create').durationDays);
  assert.ok(service.validatePlanForm(values({ maxActiveParcels: '0' }), 'create').maxActiveParcels);
});

test('create, update and stop selling use the admin plan endpoints; nothing is deleted', async () => {
  const calls = [];
  const { service } = harness(async (url, init = {}) => { calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined }); return plan(); });

  await service.listPlans();
  await service.createPlan({ ...service.emptyPlanForm(), code: ' NEW ', name: ' Gói mới ', price: '10000', durationDays: '90', maxActiveParcels: '3' });
  await service.setPlanOnSale(plan(), false);

  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    'GET /api/admin/subscription-plans',
    'POST /api/admin/subscription-plans',
    'PUT /api/admin/subscription-plans/p-1',
  ]);
  assert.deepEqual(calls[1].body, { code: 'NEW', name: 'Gói mới', description: null, price: 10000, durationDays: 90, maxActiveParcels: 3 });
  assert.deepEqual(calls[2].body, { name: 'Gói tháng', description: null, price: 49000, durationDays: 30, maxActiveParcels: 5, isActive: false });
  assert.ok(!calls.some((call) => call.method === 'DELETE'));
});

test('filters, formatting and error messages', () => {
  const { service, ApiError } = harness();
  const plans = [plan(), plan({ id: 'p-2', isActive: false })];

  assert.equal(service.filterPlans(plans, 'active').length, 1);
  assert.equal(service.filterPlans(plans, 'inactive')[0].id, 'p-2');
  assert.equal(service.filterPlans(plans, 'all').length, 2);
  assert.equal(service.formatPlanDuration(30), '1 tháng');
  assert.equal(service.formatPlanDuration(365), '1 năm');
  assert.equal(service.formatPlanDuration(10), '10 ngày');
  assert.match(service.getPlanErrorMessage(new ApiError(409, 'x', 'subscription/already_exists')), /Mã gói đã tồn tại/);
  assert.match(service.getPlanErrorMessage(new ApiError(403)), /Chỉ Quản trị viên/);
});
