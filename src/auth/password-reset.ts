export function normalizeResetEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateResetEmail(value: string) {
  const email = normalizeResetEmail(value);

  if (!email) return 'Vui lòng nhập email tài khoản.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Vui lòng nhập địa chỉ email hợp lệ.';
  }

  return undefined;
}

export function validateResetOtp(value: string) {
  return /^[0-9]{6}$/.test(value.trim())
    ? undefined
    : 'Vui lòng nhập mã OTP gồm 6 chữ số trong email.';
}
