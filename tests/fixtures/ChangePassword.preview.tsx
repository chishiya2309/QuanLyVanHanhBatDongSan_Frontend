import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { ChangePasswordModal } from '../../src/components/auth/ChangePasswordModal';
import { changePasswordMessages as m } from '../../src/types/changePassword';
import { adminProfile, customerProfile, hostProfile } from './profiles';
import '../../src/index.css';

const params = new URLSearchParams(location.search);
const role = params.get('role') || 'HOST';
const state = params.get('state') || 'success';
const profile = role === 'ADMIN' ? adminProfile : role === 'CUSTOMER' ? customerProfile : hostProfile;
const reply = (data: unknown, status = 200, message = 'OK', fieldErrors = {}) => new Response(JSON.stringify({ status, message, data, fieldErrors }), { status });
const originalFetch = window.fetch.bind(window);
let attempts = 0;

// This isolated preview is never imported by production code and stores no passwords.
window.fetch = async (input, init) => {
  const path = String(input);
  if (path.endsWith('/auth/me')) return reply({ accountId: 'preview-account', loginName: 'preview-user', role, hostId: null, customerId: null });
  if (path.endsWith('/profile')) return reply(profile);
  if (path.endsWith('/auth/csrf')) return reply({ token: 'preview-only', headerName: 'X-CSRF-TOKEN' });
  if (path.endsWith('/auth/change-password')) {
    attempts++;
    document.documentElement.dataset.passwordRequests = String(attempts);
    if (state === 'loading') return new Promise<Response>(() => undefined);
    if (state === 'network') throw new TypeError('Preview offline');
    if (state === 'error') return reply(null, 500, m.failure);
    if (state === 'field-error') return reply(null, 400, m.currentIncorrect, { currentPassword: m.currentIncorrect });
    if (state === 'forbidden') return reply(null, 403, m.forbidden);
    if (state === 'expired') return reply(null, 401, m.sessionInvalid);
    if (state === 'csrf' && attempts === 1) return reply(null, 403, m.csrfInvalid);
    return reply(null, 200, m.success);
  }
  return originalFetch(input, init);
};

export function Preview() {
  useEffect(() => {
    if (!params.has('open')) return;
    const openPassword = () => {
      const profileButton = document.querySelector<HTMLButtonElement>('.user-profile-badge');
      if (!document.querySelector('dialog[open]')) profileButton?.click();
      document.querySelector<HTMLButtonElement>('#profile-change-password')?.click();
      if (document.querySelector('.change-dialog[open]')) observer.disconnect();
    };
    const observer = new MutationObserver(openPassword);
    observer.observe(document.body, { childList: true, subtree: true });
    openPassword();
    return () => observer.disconnect();
  }, []);
  return <App />;
}

export function IsolatedPreview() {
  const [open, setOpen] = useState(true);
  return <main className="page-shell">
    <button type="button" className="change-button" onClick={() => setOpen(true)}>Mở đổi mật khẩu</button>
    {open && <ChangePasswordModal onClose={() => setOpen(false)} onAuthenticationEnded={() => setOpen(false)} />}
  </main>;
}

createRoot(document.getElementById('root')!).render(params.has('isolated') ? <IsolatedPreview /> : <Preview />);
