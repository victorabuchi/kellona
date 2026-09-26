// Where each kind of user starts after signing in.
export function homeFor(kind: 'admin' | 'resident' | 'staff', hasOrg: boolean): string {
  if (kind === 'resident') return '/book';
  if (kind === 'staff') return '/manage';
  return hasOrg ? '/manage' : '/platform';
}
