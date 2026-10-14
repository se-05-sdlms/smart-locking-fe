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
      '@/auth/password-change',
      '@/services/auth-service',
      '@/types/auth',
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
    rules: load('@/auth/password-change'),
    authService: load('@/services/auth-service'),
    ApiError,
  };
}

const session = (overrides = {}) => ({
  accessToken: 'access-test',
  refreshToken: 'refresh-test',
  accessTokenExpiresAt: '2099-01-01T00:00:00Z',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  user: {
    id: 'operator-test',
    phoneNumber: null,
    email: 'operator@test.local',
    role: 'LockerOperator',
    status: 'Active',
    mustChangePassword: false,
    lastLoginAt: null,
    ...overrides,
  },
});

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

test('minimum password length mirrors the backend rule', () => {
  const { rules } = harness();

  assert.equal(rules.MIN_PASSWORD_LENGTH, 8);
});

test('current password is required', () => {
  const { rules } = harness();

  assert.equal(rules.validateCurrentPassword(''), 'Vui lòng nhập mật khẩu hiện tại.');
  assert.equal(rules.validateCurrentPassword('Temp-1234'), undefined);
});

test('new password is required', () => {
  const { rules } = harness();

  assert.equal(rules.validateNewPassword('', 'Temp-1234'), 'Vui lòng nhập mật khẩu mới.');
});

test('new password made only of whitespace is rejected like the backend', () => {
  const { rules } = harness();
  const message = 'Mật khẩu mới không được chỉ gồm khoảng trắng.';

  assert.equal(rules.validateNewPassword('        ', 'Temp-1234'), message);
  assert.equal(rules.validateNewPassword(' \t  \t   ', 'Temp-1234'), message);
});

test('new password may contain spaces when it also has other characters', () => {
  const { rules } = harness();

  assert.equal(rules.validateNewPassword('my new pass', 'Temp-1234'), undefined);
});

test('new password shorter than 8 characters is rejected', () => {
  const { rules } = harness();

  assert.equal(
    rules.validateNewPassword('Abc-123', 'Temp-1234'),
    'Mật khẩu mới phải có ít nhất 8 ký tự.',
  );
});

test('new password of exactly 8 characters is accepted', () => {
  const { rules } = harness();

  assert.equal(rules.validateNewPassword('Abcd-123', 'Temp-1234'), undefined);
});

test('new password must differ from the current password', () => {
  const { rules } = harness();

  assert.equal(
    rules.validateNewPassword('Temp-1234', 'Temp-1234'),
    'Mật khẩu mới phải khác mật khẩu hiện tại.',
  );
});

test('new password comparison is case-sensitive like the backend hash check', () => {
  const { rules } = harness();

  assert.equal(rules.validateNewPassword('temp-1234', 'Temp-1234'), undefined);
});

test('new password is accepted before the current password is typed', () => {
  const { rules } = harness();

  assert.equal(rules.validateNewPassword('NewPass-2026', ''), undefined);
});

test('confirmation is required', () => {
  const { rules } = harness();

  assert.equal(
    rules.validateConfirmPassword('', 'NewPass-2026'),
    'Vui lòng xác nhận mật khẩu mới.',
  );
});

test('confirmation must match the new password exactly', () => {
  const { rules } = harness();

  assert.equal(
    rules.validateConfirmPassword('NewPass-2025', 'NewPass-2026'),
    'Mật khẩu xác nhận không khớp.',
  );
  assert.equal(
    rules.validateConfirmPassword('newpass-2026', 'NewPass-2026'),
    'Mật khẩu xác nhận không khớp.',
  );
  assert.equal(rules.validateConfirmPassword('NewPass-2026', 'NewPass-2026'), undefined);
});

// ---------------------------------------------------------------------------
// Route access for /admin and /operator
// ---------------------------------------------------------------------------

test('role routes send anonymous visitors to login', () => {
  const { rules } = harness();

  assert.equal(rules.resolveRoleAccess(null, 'operator'), 'login');
  assert.equal(rules.resolveRoleAccess(null, 'admin'), 'login');
});

test('operator with a temporary password is sent to the change-password screen', () => {
  const { rules } = harness();

  assert.equal(
    rules.resolveRoleAccess(session({ mustChangePassword: true }), 'operator'),
    'change-password',
  );
});

test('operator who already changed the password can enter the operator area', () => {
  const { rules } = harness();

  assert.equal(rules.resolveRoleAccess(session(), 'operator'), 'allow');
});

test('operator cannot enter the admin area', () => {
  const { rules } = harness();

  assert.equal(rules.resolveRoleAccess(session(), 'admin'), 'forbidden');
  assert.equal(
    rules.resolveRoleAccess(session({ mustChangePassword: true }), 'admin'),
    'forbidden',
  );
});

test('administrator area is not gated by the operator first-login rule', () => {
  const { rules } = harness();
  const admin = session({ role: 'Administrator', mustChangePassword: true });

  assert.equal(rules.resolveRoleAccess(admin, 'admin'), 'allow');
  assert.equal(rules.resolveRoleAccess(admin, 'operator'), 'forbidden');
});

test('inactive accounts are forbidden before the password rule is checked', () => {
  const { rules } = harness();

  for (const status of ['Disabled', 'Locked']) {
    assert.equal(
      rules.resolveRoleAccess(session({ status, mustChangePassword: true }), 'operator'),
      'forbidden',
    );
  }
});

test('resident accounts are forbidden in both portals', () => {
  const { rules } = harness();
  const resident = session({ role: 'Resident' });

  assert.equal(rules.resolveRoleAccess(resident, 'operator'), 'forbidden');
  assert.equal(rules.resolveRoleAccess(resident, 'admin'), 'forbidden');
});

// ---------------------------------------------------------------------------
// Route access for the first-login screen itself
// ---------------------------------------------------------------------------

test('first-login screen requires a session', () => {
  const { rules } = harness();

  assert.equal(rules.resolvePasswordChangeAccess(null), 'login');
});

test('first-login screen is shown only while the temporary password is active', () => {
  const { rules } = harness();

  assert.equal(
    rules.resolvePasswordChangeAccess(session({ mustChangePassword: true })),
    'allow',
  );
  assert.equal(rules.resolvePasswordChangeAccess(session()), 'operator');
});

test('first-login screen is forbidden for administrators, residents and inactive operators', () => {
  const { rules } = harness();

  assert.equal(
    rules.resolvePasswordChangeAccess(session({ role: 'Administrator', mustChangePassword: true })),
    'forbidden',
  );
  assert.equal(
    rules.resolvePasswordChangeAccess(session({ role: 'Resident', mustChangePassword: true })),
    'forbidden',
  );
  assert.equal(
    rules.resolvePasswordChangeAccess(session({ status: 'Locked', mustChangePassword: true })),
    'forbidden',
  );
});

test('first-login path stays inside the operator area', () => {
  const { rules } = harness();

  assert.equal(
    rules.FIRST_LOGIN_CHANGE_PASSWORD_PATH,
    '/operator/first-login-change-password',
  );
});

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------

test('change password posts the backend DTO with the default bearer boundary', async () => {
  const calls = [];
  const response = session();
  const { authService } = harness(async (url, options) => {
    calls.push({ url, options });
    return response;
  });

  const result = await authService.changePassword({
    currentPassword: 'Temp-1234',
    newPassword: 'NewPass-2026',
  });

  assert.equal(result, response);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/auth/change-password');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.auth, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    currentPassword: 'Temp-1234',
    newPassword: 'NewPass-2026',
  });
});

test('change password propagates backend errors to the caller', async () => {
  const { authService, ApiError } = harness(async () => {
    throw new ApiError(400, 'Current password is incorrect.');
  });

  await assert.rejects(
    authService.changePassword({ currentPassword: 'x', newPassword: 'NewPass-2026' }),
    (error) => error instanceof ApiError && error.status === 400,
  );
});

// ---------------------------------------------------------------------------
// Vietnamese error messages
// ---------------------------------------------------------------------------

test('backend 400 messages are translated to Vietnamese', () => {
  const { authService, ApiError } = harness();
  const message = (text) =>
    authService.getChangePasswordErrorMessage(new ApiError(400, text));

  assert.equal(message('Current password is incorrect.'), 'Mật khẩu hiện tại không đúng.');
  assert.equal(
    message('New password must be different from the current password. (Parameter \'NewPassword\')'),
    'Mật khẩu mới phải khác mật khẩu hiện tại.',
  );
  assert.equal(
    message('Password must contain at least 8 characters. (Parameter \'NewPassword\')'),
    'Mật khẩu mới phải có ít nhất 8 ký tự.',
  );
  assert.equal(message('Something else'), 'Thông tin đổi mật khẩu không hợp lệ.');
});

test('transport and server errors are translated to Vietnamese', () => {
  const { authService, ApiError } = harness();
  const message = (status) =>
    authService.getChangePasswordErrorMessage(new ApiError(status, 'raw'));

  assert.equal(message(0), 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  assert.equal(message(401), 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  assert.equal(message(408), 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.');
  assert.equal(message(429), 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.');
  assert.equal(message(500), 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
  assert.equal(message(503), 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
});

test('unknown errors never leak raw English text', () => {
  const { authService, ApiError } = harness();
  const fallback = 'Không thể đổi mật khẩu. Vui lòng thử lại.';

  assert.equal(authService.getChangePasswordErrorMessage(new ApiError(404, 'Not Found')), fallback);
  assert.equal(authService.getChangePasswordErrorMessage(new Error('boom')), fallback);
  assert.equal(authService.getChangePasswordErrorMessage('boom'), fallback);
  assert.equal(authService.getChangePasswordErrorMessage(undefined), fallback);
});

test('ProblemDetails 400 without a recognisable detail falls back to a generic Vietnamese message', () => {
  const { authService, ApiError } = harness();

  // api-client uses `detail` when present; a bare ProblemDetails only has the title.
  assert.equal(
    authService.getChangePasswordErrorMessage(new ApiError(400, 'Bad Request')),
    'Thông tin đổi mật khẩu không hợp lệ.',
  );
});
