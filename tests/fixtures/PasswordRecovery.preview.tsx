import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { ForgotPasswordPage, ResetPasswordPage } from '../../src/components/auth/PasswordRecoveryPage';
import { createRecoveryBootstrap } from '../../src/utils/recoveryNavigation';
import { recoveryMessages as m } from '../../src/types/passwordRecovery';
import '../../src/index.css';

const params = new URLSearchParams(location.search);
const screen = params.get('screen') || 'forgot';
const state = params.get('state') || 'success';
const fragment = location.hash;
history.replaceState(null, '', screen === 'reset' ? '/reset-password' + fragment : screen === 'login' ? '/' : '/forgot-password');
const bootstrap = createRecoveryBootstrap();
const originalFetch = window.fetch.bind(window);
const counts = { forgot: 0, validate: 0, reset: 0 };
const reply = (message: string, status = 200, fieldErrors = {}) => new Response(JSON.stringify({ status, message, data: null, fieldErrors }), { status });

// Only this development fixture installs fake responses; production never imports it.
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/auth/csrf')) return new Response(JSON.stringify({ status: 200, data: { token: 'preview-only', headerName: 'X-CSRF-TOKEN' } }));
  if (url.endsWith('/auth/me')) { document.documentElement.dataset.recoveryAuthBootstrap = 'called'; return reply('guest', 401); }
  const operation = url.endsWith('/forgot-password') ? 'forgot' : url.endsWith('/reset-password/validate') ? 'validate' : url.endsWith('/reset-password') ? 'reset' : null;
  if (!operation) return originalFetch(input, init);
  counts[operation]++; document.documentElement.dataset[operation + 'Requests'] = String(counts[operation]);
  if ((state === 'checking' && operation === 'validate') || (state === 'loading' && operation !== 'validate')) return new Promise<Response>(() => undefined);
  if (state === 'verify-error' && operation === 'validate' && counts.validate === 1) throw new TypeError('Preview offline');
  if (operation === 'validate') return state === 'invalid' ? reply(m.linkInvalid, 400) : reply(m.linkValid);
  if (state === 'network') throw new TypeError('Preview offline');
  if (state === 'error') return reply(m.failure, 500);
  if (state === 'csrf' && counts[operation] === 1) return reply(m.csrfInvalid, 403);
  if (state === 'expired' && operation === 'reset') return reply(m.requestInvalid, 400);
  if (state === 'field-error') return operation === 'forgot' ? reply(m.emailInvalid, 400, { email: m.emailInvalid }) : reply(m.minLength, 400, { newPassword: m.minLength });
  return reply(operation === 'forgot' ? m.accepted : m.success);
};

export function RecoveryPreview() {
  if (params.has('isolated')) return screen === 'reset'
    ? <ResetPasswordPage token="preview-only" onLogin={() => undefined} onNewRequest={() => undefined} onSuccess={() => undefined} isolated />
    : <ForgotPasswordPage onLogin={() => undefined} isolated />;
  return <App initialRecovery={bootstrap} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><RecoveryPreview /></StrictMode>);
