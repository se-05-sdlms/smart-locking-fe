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
    if (name !== '@/constants/error-codes') assert.equal(name, '@/services/notification-rule-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/notification-rule-service'), ApiError };
}

const rule = (overrides = {}) => ({
  id: 'rule-1',
  systemPolicyId: 'policy-1',
  eventType: 'DoorOpenTooLong',
  channel: 1,
  leadTimeMinutes: null,
  isEnabled: true,
  ...overrides,
});

test('known events and channels have Vietnamese labels; unknown events stay as their code', () => {
  const { service } = harness();

  assert.equal(service.notificationEventLabel('DoorOpenTooLong'), 'Cửa ngăn mở quá lâu');
  assert.equal(service.notificationEventLabel('LockerOffline'), 'Tủ mất kết nối');
  assert.equal(service.notificationEventLabel('PickupReminder'), 'PickupReminder');
  assert.deepEqual(Object.values(service.NOTIFICATION_CHANNEL_LABELS), ['Trong ứng dụng', 'Thông báo đẩy', 'SMS', 'Email']);
});

test('form values round-trip a rule, keeping an empty lead time as "send now"', () => {
  const { service } = harness();

  assert.deepEqual(service.toRuleFormValues(rule()), {
    eventType: 'DoorOpenTooLong', channel: 1, leadTimeMinutes: '', isEnabled: true,
  });
  assert.equal(service.toRuleFormValues(rule({ leadTimeMinutes: 30 })).leadTimeMinutes, '30');
  assert.equal(service.emptyRuleForm().eventType, service.KNOWN_NOTIFICATION_EVENTS[0]);
});

test('validation mirrors the backend rules for event type, channel and lead time', () => {
  const { service } = harness();
  const values = (overrides = {}) => ({ ...service.emptyRuleForm(), ...overrides });

  assert.deepEqual(service.validateRuleForm(values()), {});
  assert.ok(service.validateRuleForm(values({ eventType: '  ' })).eventType);
  assert.ok(service.validateRuleForm(values({ eventType: 'x'.repeat(101) })).eventType);
  assert.deepEqual(service.validateRuleForm(values({ eventType: 'x'.repeat(100) })), {});
  assert.ok(service.validateRuleForm(values({ channel: 9 })).channel);
  assert.ok(service.validateRuleForm(values({ leadTimeMinutes: '-1' })).leadTimeMinutes);
  assert.ok(service.validateRuleForm(values({ leadTimeMinutes: '1.5' })).leadTimeMinutes);
  assert.ok(service.validateRuleForm(values({ leadTimeMinutes: 'abc' })).leadTimeMinutes);
  assert.deepEqual(service.validateRuleForm(values({ leadTimeMinutes: '0' })), {});
});

test('list, create and update call the notification-rules API with trimmed payloads', async () => {
  const calls = [];
  const { service } = harness(async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    return [];
  });

  await service.listNotificationRules('policy-1');
  await service.createNotificationRule('policy-1', {
    eventType: '  LockerOffline ', channel: 3, leadTimeMinutes: ' 15 ', isEnabled: false,
  });
  await service.updateNotificationRule('rule-1', { leadTimeMinutes: '', isEnabled: true });

  assert.equal(calls[0].url, '/api/notification-rules?systemPolicyId=policy-1');
  assert.deepEqual(calls[1], {
    url: '/api/notification-rules',
    method: 'POST',
    body: { systemPolicyId: 'policy-1', eventType: 'LockerOffline', channel: 3, leadTimeMinutes: 15, isEnabled: false },
  });
  assert.deepEqual(calls[2], {
    url: '/api/notification-rules/rule-1',
    method: 'PATCH',
    body: { leadTimeMinutes: null, isEnabled: true },
  });
});

test('errors are mapped by backend error code and validation field', () => {
  const { service, ApiError } = harness();
  const message = (status, code, errors) =>
    service.getNotificationRuleErrorMessage(new ApiError(status, 'English detail', code, errors));

  assert.match(message(409, 'notification/rule_already_exists'), /Đã có quy tắc/);
  assert.match(message(409, 'policy/immutable'), /không thể sửa quy tắc/);
  assert.match(message(404, 'notification/not_found'), /Không tìm thấy quy tắc/);
  assert.match(message(400, 'validation/invalid_input', { leadTimeMinutes: ['x'] }), /không được âm/);
  assert.equal(message(400, 'validation/invalid_input'), 'Thông tin quy tắc không hợp lệ.');
  assert.match(message(500), /Máy chủ đang gặp sự cố/);
  assert.equal(service.getNotificationRuleErrorMessage(undefined), 'Không thể xử lý quy tắc thông báo. Vui lòng thử lại.');
});

test('rules from another policy version are never shown or acted on (review #73)', () => {
  const { service } = harness();
  const rules = [rule({ id: 'a-1', systemPolicyId: 'policy-A' }), rule({ id: 'b-1', systemPolicyId: 'policy-B' })];

  assert.deepEqual(service.rulesForPolicy(rules, 'policy-B').map((item) => item.id), ['b-1']);
  assert.deepEqual(service.rulesForPolicy(rules, 'policy-C'), []);
});

test('the rules section remounts per policy version so stale data and forms are dropped (review #73)', () => {
  const source = readFileSync(path.join(__dirname, '..', 'src', 'components', 'admin', 'policies', 'notification-rules-card.tsx'), 'utf8');

  assert.match(source, /<PolicyRulesSection key=\{policy\.id\} policy=\{policy\} \/>/);
  // The table and the add button only render once this version's request succeeded.
  assert.match(source, /isReady && rules\.length > 0/);
  assert.match(source, /isDisabled=\{!isEditable \|\| !isReady\}/);
  assert.match(source, /rule\.systemPolicyId !== policy\.id\) return;/);
});
