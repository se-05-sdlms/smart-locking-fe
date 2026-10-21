const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS module with stubbed API/auth boundaries. No HTTP, session or secrets.
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
    if (name === '@/services/api-client') {
      return { ApiError, apiRequest: request, refreshAuthSession: async () => ({ accessToken: 'new' }) };
    }
    if (name === '@/auth/auth-storage') return { readAuthSession: () => ({ accessToken: 'token' }) };
    if (name === '@/config/api') return { getApiUrl: (p) => `http://api${p}` };
    if (cache.has(name)) return cache.get(name).exports;
    assert.equal(name, '@/services/notification-service');
    const filename = path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { service: load('@/services/notification-service'), ApiError };
}

const notification = (overrides = {}) => ({
  id: 'n-1',
  type: 'LockerOffline',
  title: 'Locker disconnected',
  message: 'Locker SEED-LKR-001 is offline.',
  deliveryRequestId: null,
  returnRequestId: null,
  parcelId: null,
  incidentId: null,
  paymentTransactionId: null,
  isRead: false,
  readAt: null,
  createdAt: '2026-10-21T08:00:00Z',
  ...overrides,
});

test('titles and descriptions are Vietnamese and never echo the English message', () => {
  const { service } = harness();

  assert.equal(service.notificationTitle(notification()), 'Tủ mất kết nối');
  assert.equal(service.notificationDescription(notification()), 'Tủ SEED-LKR-001 không còn gửi tín hiệu về hệ thống.');
  const door = notification({ type: 'DoorOpenTooLong', message: 'Locker LK-02: Door open too long.' });
  assert.equal(service.notificationTitle(door), 'Cửa ngăn mở quá lâu');
  assert.match(service.notificationDescription(door), /^Tủ LK-02 có ngăn chưa đóng cửa/);
  const unknown = notification({ type: 'SomethingNew', message: 'Hello world' });
  assert.equal(service.notificationTitle(unknown), 'Thông báo hệ thống');
  assert.equal(service.notificationDescription(unknown), 'Mở để xem chi tiết.');
});

test('deep links only use whitelisted operator routes with an encoded entity id', () => {
  const { service } = harness();

  assert.equal(service.notificationTarget(notification({ incidentId: 'i-1' }), 'operator'), '/operator/incidents?incident=i-1');
  assert.equal(service.notificationTarget(notification({ incidentId: 'a/b?c' }), 'operator'), '/operator/incidents?incident=a%2Fb%3Fc');
  assert.equal(service.notificationTarget(notification(), 'operator'), '/operator/lockers');
  assert.equal(service.notificationTarget(notification({ type: 'ParcelStored', parcelId: 'p-1' }), 'operator'), '/operator/overdue-clearance/p-1');
  assert.equal(service.notificationTarget(notification({ type: 'ParcelStored' }), 'operator'), null);
  assert.equal(service.notificationTarget(notification({ incidentId: 'i-1' }), 'admin'), null);
});

test('unread count and local read updates', () => {
  const { service } = harness();
  const list = [notification(), notification({ id: 'n-2' }), notification({ id: 'n-3', isRead: true, readAt: 'x' })];

  assert.equal(service.countUnread(list), 2);
  const one = service.markReadLocally(list, 'n-1', 'now');
  assert.equal(service.countUnread(one), 1);
  assert.equal(one[0].readAt, 'now');
  assert.equal(one[2].readAt, 'x');
  assert.equal(service.countUnread(service.markReadLocally(list, 'all', 'now')), 0);
});

test('API calls use the notifications endpoints', async () => {
  const calls = [];
  const { service } = harness(async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url}`);
    return [];
  });

  await service.listNotifications();
  await service.markNotificationRead('n 1');
  await service.markAllNotificationsRead();
  assert.deepEqual(calls, [
    'GET /api/notifications?limit=30',
    'PATCH /api/notifications/n%201/read',
    'PATCH /api/notifications/read-all',
  ]);
});

test('errors are shown in Vietnamese', () => {
  const { service, ApiError } = harness();

  assert.equal(service.getNotificationErrorMessage(new ApiError(0)), 'Không thể kết nối đến máy chủ.');
  assert.equal(service.getNotificationErrorMessage(new ApiError(404)), 'Thông báo không còn tồn tại.');
  assert.equal(service.getNotificationErrorMessage(new ApiError(502)), 'Máy chủ đang gặp sự cố.');
  assert.equal(service.getNotificationErrorMessage(undefined), 'Không thể tải thông báo.');
});
