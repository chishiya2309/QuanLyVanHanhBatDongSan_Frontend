import type { RecoveryEntry } from '../types/passwordRecovery';

export function recoveryPath(pathname: string): RecoveryEntry['path'] {
  return pathname === '/forgot-password' || pathname === '/reset-password' ? pathname : null;
}

export function captureRecoveryEntry(): RecoveryEntry {
  const path = recoveryPath(window.location.pathname);
  let token: string | null = null;
  if (path === '/reset-password') {
    const tokens = new URLSearchParams(window.location.hash.slice(1)).getAll('token');
    if (tokens.length === 1 && tokens[0].trim()) token = tokens[0];
    window.history.replaceState(null, '', path);
  }
  return { path, token };
}

export interface RecoveryBootstrap { read: () => RecoveryEntry; release: () => void; }
export function createRecoveryBootstrap(): RecoveryBootstrap {
  let entry = captureRecoveryEntry();
  return { read: () => ({ ...entry }), release: () => { entry = { ...entry, token: null }; } };
}
