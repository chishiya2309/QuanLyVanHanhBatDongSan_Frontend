import { HOST_ACCOUNTS_PATH, type HostAccountRoute } from '../types/hostAccounts';

export function parseHostAccountRoute(path: string): HostAccountRoute | null {
  if (path === HOST_ACCOUNTS_PATH || path === HOST_ACCOUNTS_PATH + '/') return { accountId: null };
  if (!path.startsWith(HOST_ACCOUNTS_PATH + '/')) return null;
  const value = path.slice(HOST_ACCOUNTS_PATH.length + 1);
  try { return { accountId: decodeURIComponent(value) }; }
  catch { return { accountId: value }; }
}
