import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProfileModal } from '../../src/components/profile/ProfileModal';
import { useProfile } from '../../src/hooks/useProfile';
import { profileMessages } from '../../src/types/profile';
import { adminProfile, customerProfile, hostProfile } from './profiles';
import '../../src/tokens.css';
import '../../src/base.css';
import './profile-preview.css';

const params = new URLSearchParams(location.search);
const profile = params.get('role') === 'ADMIN' ? adminProfile : params.get('role') === 'CUSTOMER' ? customerProfile : hostProfile;
const state = params.get('state') || 'full';
const mode = params.get('mode') || 'view';
let stored = params.has('long') && profile.role === 'HOST' ? { ...profile, businessName: `${profile.businessName} — ${'Đơn vị quản lý bất động sản '.repeat(8)}`, email: `${'rentops'.repeat(12)}@example.com` } : profile;
let patchCount = 0;
const respond = (data: unknown, status = 200, message = 'Thông tin hồ sơ') => new Response(JSON.stringify({ status, message, data }), { status });
const originalFetch = window.fetch.bind(window);

// Only this standalone QA entry installs fixtures. Production imports neither this file nor its routes.
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/auth/csrf')) return respond({ token: 'preview-only', headerName: 'X-CSRF-TOKEN' });
  if (!url.endsWith('/profile')) return originalFetch(input, init);
  if (state === 'loading') return new Promise<Response>(() => undefined);
  if (state === 'empty') return respond(null, 404, profileMessages.notFound);
  if (init?.method === 'PATCH') {
    patchCount++;
    if (state === 'saving') return new Promise<Response>(() => undefined);
    if (state === 'error') return respond(null, 500, profileMessages.saveFailure);
    if (state === 'field-error') return new Response(JSON.stringify({ status: 409, message: profileMessages.phoneDuplicate, fieldErrors: { phoneNumber: profileMessages.phoneDuplicate } }), { status: 409 });
    const body = init.body instanceof FormData ? JSON.parse(await (init.body.get('profile') as Blob).text()) as Record<string, unknown> : JSON.parse(String(init.body)) as Record<string, unknown>;
    stored = { ...stored, ...body };
    return respond(stored, 200, profileMessages.success);
  }
  return respond(stored);
};

export function Preview() {
  const onExpired = useCallback(() => undefined, []);
  const c = useProfile(onExpired);
  const [open, setOpen] = useState(true);
  const configured = useRef(false);
  const submitted = useRef(false);
  useEffect(() => {
    if (c.profile && !configured.current && mode === 'edit') { configured.current = true; c.startEditing(); }
    if (c.isEditing && !submitted.current && ['saving', 'error', 'field-error', 'success'].includes(state)) {
      submitted.current = true;
      void c.handleSubmit();
    }
  }, [c]);
  return <main className="profile-preview-shell">
    <p className="profile-preview-brand">RentOps</p>
    <button type="button" className="profile-button profile-button--secondary" onClick={() => { setOpen(true); void c.fetchProfile(); }}>Mở hồ sơ</button>
    <ProfileModal isOpen={open} controller={c} onClose={() => setOpen(false)} />
    <output className="visually-hidden" aria-label="Số lần cập nhật">{patchCount}</output>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
