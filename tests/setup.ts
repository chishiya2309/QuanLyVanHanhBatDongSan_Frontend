import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLElement>('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}
if (!URL.createObjectURL) URL.createObjectURL = () => '';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;

beforeEach(() => {
  let sequence = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:profile-${++sequence}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
