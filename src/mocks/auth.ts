export type MockRole = 'admin' | 'operator';

export type MockAccount = {
  username: string;
  password: string;
  role: MockRole;
};

export const mockAccounts: MockAccount[] = [
  { username: 'admin', password: '123456', role: 'admin' },
  { username: 'operator', password: '123456', role: 'operator' },
];

export function authenticate(
  username: string,
  password: string,
): MockAccount | undefined {
  return mockAccounts.find(
    (account) => account.username === username && account.password === password,
  );
}
