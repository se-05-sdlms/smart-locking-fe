const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function harness(request = async () => undefined) {
  const cache = new Map();
  class ApiError extends Error {
    constructor(status, code) { super('untrusted backend text'); this.status = status; this.code = code; }
  }
  function load(name) {
    if (name === '@/services/api-client') return { ApiError, apiRequest: request };
    if (cache.has(name)) return cache.get(name).exports;
    assert.ok(['@/auth/password-reset', '@/auth/password-change', '@/services/auth-service', '@/types/auth', '@/constants/error-codes'].includes(name), name);
    const module = { exports: {} };
    cache.set(name, module);
    const code = ts.transpileModule(readFileSync(path.join(__dirname, '..', 'src', `${name.slice(2)}.ts`), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return { rules: load('@/auth/password-reset'), service: load('@/services/auth-service'), ApiError };
}

test('email reset rejects phone, blank and malformed email without changing accepted normalized email', () => {
  const { rules } = harness();
  for (const value of ['', '   ', '0901234567', 'hello', 'a@b', 'a b@example.com', 'a@@example.com']) {
    assert.ok(rules.validateResetEmail(value), value);
  }
  assert.equal(rules.validateResetEmail('  Operator+1@Example.COM  '), undefined);
  assert.equal(rules.normalizeResetEmail('  Operator+1@Example.COM  '), 'operator+1@example.com');
});

test('OTP validation preserves leading zeros and accepts only six ASCII digits', () => {
  const { rules } = harness();
  assert.equal(rules.validateResetOtp(' 012345 '), undefined);
  for (const value of ['', '12345', '1234567', '12345x', '12 345', '１２３４５６']) {
    assert.ok(rules.validateResetOtp(value), value);
  }
});

test('request/resend posts only normalized email to the anonymous existing endpoint', async () => {
  const calls = [];
  const { service } = harness(async (...args) => calls.push(args));
  await service.requestPasswordReset('  Admin@Example.COM ');
  await service.requestPasswordReset('admin@example.com');
  assert.equal(calls.length, 2);
  for (const [url, options] of calls) {
    assert.equal(url, '/api/auth/forgot-password');
    assert.equal(options.auth, false);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { loginIdentifier: 'admin@example.com' });
  }
});

test('confirmation uses same email and string OTP, preserves password spaces and sends no confirmation field', async () => {
  let call;
  const { service } = harness(async (...args) => { call = args; });
  await service.resetPassword(' Admin@Example.COM ', ' 012345 ', ' my new pass ');
  assert.equal(call[0], '/api/auth/reset-password');
  assert.equal(call[1].auth, false);
  assert.equal(call[1].method, 'POST');
  assert.deepEqual(JSON.parse(call[1].body), { loginIdentifier: 'admin@example.com', otpCode: '012345', newPassword: ' my new pass ' });
});

test('transport failures propagate so the form cannot report success or fall back to SMS', async () => {
  const calls = [];
  const failure = new Error('delivery failed');
  const { service } = harness(async (...args) => { calls.push(args); throw failure; });
  await assert.rejects(service.requestPasswordReset('admin@example.com'), (error) => error === failure);
  await assert.rejects(service.resetPassword('admin@example.com', '012345', 'new pass'), (error) => error === failure);
  assert.equal(calls.length, 2);
});

test('invalid, expired or reused OTP has actionable Vietnamese recovery', () => {
  const { service, ApiError } = harness();
  assert.match(service.getPasswordResetErrorMessage(new ApiError(400, 'auth/invalid_otp')), /gửi lại mã/);
});

test('network, throttling, validation and server failures have safe actionable messages', () => {
  const { service, ApiError } = harness();
  for (const [status, code, expected] of [
    [0, undefined, /kết nối/], [429, undefined, /quá nhiều/], [400, 'common/rate_limited', /quá nhiều/],
    [408, undefined, /quá chậm/], [503, 'email\/unavailable', /thử lại sau/], [400, undefined, /chưa hợp lệ/],
  ]) {
    const message = service.getPasswordResetErrorMessage(new ApiError(status, code));
    assert.match(message, expected);
    assert.ok(!message.includes('untrusted backend text'));
  }
  assert.match(service.getPasswordResetErrorMessage(new Error('private provider details')), /Vui lòng thử lại/);
});
