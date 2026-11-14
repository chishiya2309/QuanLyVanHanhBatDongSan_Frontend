import { announceSession, invalidateSession } from '../src/services/sessionClient';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// App intentionally shows an 800ms session splash. Leave room for the following
// API/render work on a busy worker, rather than racing the default 1000ms query.
configure({ asyncUtilTimeout: 3000 });

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLElement>('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}
if (!URL.createObjectURL) URL.createObjectURL = () => '';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;

beforeEach(() => {
  invalidateSession();
  announceSession(null);
  localStorage.clear();
  sessionStorage.clear();
  let sequence = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:profile-${++sequence}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
