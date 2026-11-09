import { Card } from '@heroui/react';
import ShieldCheck from '@gravity-ui/icons/ShieldCheck';

import { useAuth } from '@/auth/auth-context';
import {
  ChangePasswordCard,
  ProfileCard,
  SessionCard,
} from '@/components/account/account-cards';

const ADMIN_ACCOUNT_NOTE =
  'Tài khoản Quản trị viên được cấp khi khởi tạo hệ thống. Thông tin đăng nhập không chỉnh sửa tại đây; liên hệ bộ phận kỹ thuật nếu cần thay đổi.';

const SECURITY_PRACTICES = [
  'Không dùng chung tài khoản Quản trị viên; mỗi thao tác quan trọng đều được ghi vào Audit log theo tài khoản.',
  'Đổi mật khẩu định kỳ và không dùng lại mật khẩu của hệ thống khác.',
  'Đăng xuất khi dùng máy tính chung. Sau khi đổi mật khẩu, các phiên đăng nhập khác sẽ bị đăng xuất.',
] as const;

function SecurityPracticesCard() {
  return (
    <Card>
      <Card.Header className="flex-row items-center gap-3">
        <ShieldCheck aria-hidden="true" className="size-6 text-accent" />
        <Card.Title>Bảo mật tài khoản</Card.Title>
      </Card.Header>
      <Card.Content>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          {SECURITY_PRACTICES.map((practice) => (
            <li key={practice}>{practice}</li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

export default function AdminSettingsPage() {
  // The profile comes from the auth context (refreshed from GET /api/auth/me
  // on load); calling /me again would spend the auth rate limit.
  const { user } = useAuth();

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {user ? <ProfileCard note={ADMIN_ACCOUNT_NOTE} user={user} /> : null}
      <ChangePasswordCard />
      <SecurityPracticesCard />
      <SessionCard />
    </section>
  );
}
