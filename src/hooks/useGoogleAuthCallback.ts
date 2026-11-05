import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthApiError, clearCsrfCache, getCurrentUser, initiateGoogleLogin } from '../services/authApi';
import { cancelGoogleOnboarding, getGoogleOnboarding, registerWithGoogle, setGooglePassword } from '../services/googleAuthApi';
import { validateGoogleOnboarding } from '../schemas/googleOnboardingValidation';
import type { AuthenticatedUserResponse, GoogleOnboardingContext, GoogleOnboardingErrors, GoogleOnboardingForm } from '../types/auth';
const empty: GoogleOnboardingForm = { fullName: '', phoneNumber: '', password: '', confirmPassword: '' };
const expiredMessage = 'Yêu cầu đăng nhập Google đã hết hạn hoặc đã được sử dụng. Vui lòng tiếp tục lại với Google';
function readEntry() {
  const status = new URLSearchParams(window.location.search).get('status');
  return { status, onboarding: window.location.pathname === '/auth/onboarding' || status === 'onboarding_required' };
}
function entryError(status: string | null) {
  if (status === 'account_locked') return 'Tài khoản đã bị khóa';
  if (status === 'email_not_supported') return 'Vui lòng chọn Gmail hoặc Google Workspace đã xác minh, hoặc đăng nhập bằng email và mật khẩu';
  if (status === 'conflict') return 'Không thể liên kết tài khoản Google này. Vui lòng kiểm tra tài khoản đang sử dụng';
  if (status === 'link_required') return 'Yêu cầu Google cũ không còn được hỗ trợ. Vui lòng tiếp tục lại với Google';
  if (status === 'error') return 'Không thể đăng nhập bằng Google. Vui lòng thử lại sau';
  return null;
}
export function useGoogleAuthCallback(onLoginSuccess?: (user: AuthenticatedUserResponse) => void) {
  const [entry, setEntry] = useState(readEntry);
  const [context, setContext] = useState<GoogleOnboardingContext | null>(null);
  const [form, setForm] = useState<GoogleOnboardingForm>(empty);
  const [errors, setErrors] = useState<GoogleOnboardingErrors>({});
  const [googleError, setGoogleError] = useState<string | null>(() => entryError(entry.status));
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'submitting' | 'expired' | 'failed' | 'uncertain'>('loading');
  const [showPassword, setShowPassword] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const success = useRef(onLoginSuccess);
  const contextRef = useRef(context);
  useEffect(() => { success.current = onLoginSuccess; contextRef.current = context; });
  const finish = useCallback((user: AuthenticatedUserResponse) => {
    setForm(empty); setContext(null); clearCsrfCache();
    if (window.location.pathname.startsWith('/auth/')) window.history.replaceState(null, '', '/');
    success.current?.(user);
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    clearCsrfCache();
    if (entry.onboarding) {
      window.history.replaceState(null, '', '/auth/onboarding');
      getGoogleOnboarding().then((data) => {
        if (generation.current !== current) return;
        setContext(data); setForm({ ...empty, fullName: data.suggestedName || '' });
        const expired = Date.parse(data.expiresAt) <= Date.now();
        setPhase(expired ? 'expired' : 'ready');
        if (expired) setError(expiredMessage);
      }).catch((e: unknown) => {
        if (generation.current !== current) return;
        setError(e instanceof AuthApiError ? e.message : 'Không thể tải thông tin Google');
        setPhase(e instanceof AuthApiError && e.status === 401 ? 'expired' : 'failed');
      });
    } else if (entry.status) {
      window.history.replaceState(null, '', '/');
      if (entry.status === 'success') getCurrentUser({ refresh: false }).then((u) => { if (generation.current === current) finish(u); })
        .catch(() => { if (generation.current === current) setGoogleError('Không thể đăng nhập bằng Google. Vui lòng thử lại sau'); });
    }
    return () => { generation.current = current + 1; };
  }, [entry, finish]);

  useEffect(() => {
    const pop = () => {
      if (busy.current) { window.history.pushState(null, '', '/auth/onboarding'); return; }
      const next = readEntry();
      if (!next.onboarding && contextRef.current) void cancelGoogleOnboarding(contextRef.current.flowId).catch(() => undefined);
      setForm(empty); setContext(null); setErrors({}); setError(null); setPhase('loading'); setEntry(next);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!context) return;
    const timer = window.setTimeout(() => { if (!busy.current) { setPhase('expired'); setForm(empty); setError(expiredMessage); } },
      Math.max(0, Math.min(2147483647, Date.parse(context.expiresAt) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [context]);

  const change = (field: keyof GoogleOnboardingForm, value: string) => {
    setForm((data) => ({ ...data, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined })); setError(null);
  };
  const recover = async () => {
    try {
      const user = await getCurrentUser({ refresh: false });
      if (context && user.loginName.trim().toLowerCase() === context.email) { finish(user); return; }
    }
    catch (e) {
      if (!(e instanceof AuthApiError) || e.status !== 401) { setPhase('uncertain'); setError('Chưa thể xác nhận kết quả. Vui lòng kiểm tra kết nối rồi kiểm tra lại'); return; }
    }
    try {
      const latest = await getGoogleOnboarding();
      if (latest.flowId !== context?.flowId) { setPhase('expired'); setForm(empty); setError('Yêu cầu Google đã thay đổi. Vui lòng tiếp tục lại với Google'); return; }
      setPhase('ready'); setError('Chưa hoàn tất đăng nhập. Bạn có thể thử gửi lại');
    } catch (e) {
      setPhase(e instanceof AuthApiError && e.status === 401 ? 'expired' : 'uncertain');
      setError(e instanceof AuthApiError ? e.message : expiredMessage);
    }
  };
  const submit = async () => {
    if (!context || busy.current || phase !== 'ready') return;
    if (Date.parse(context.expiresAt) <= Date.now()) { setPhase('expired'); setError(expiredMessage); setForm(empty); return; }
    const validation = validateGoogleOnboarding(form, context.purpose);
    setErrors(validation); setError(null);
    if (Object.keys(validation).length) {
      document.getElementById(`google-${Object.keys(validation)[0]}`)?.focus(); return;
    }
    busy.current = true; setPhase('submitting');
    const current = generation.current;
    try {
      const input = { flowId: context.flowId, password: form.password, confirmPassword: form.confirmPassword };
      const user = context.purpose === 'REGISTER_HOST' ? await registerWithGoogle({ ...input, fullName: form.fullName, phoneNumber: form.phoneNumber })
        : await setGooglePassword(input);
      if (generation.current === current) finish(user);
    } catch (e) {
      if (generation.current !== current) return;
      if (e instanceof AuthApiError && e.status === 0) { await recover(); return; }
      const api = e instanceof AuthApiError ? e : null;
      setPhase(api?.status === 401 || api?.status === 409 && !api.fieldErrors?.phoneNumber ? 'expired' : 'ready');
      setError(api?.message || 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại');
      const fields = api?.fieldErrors || {};
      setErrors(fields);
      const first = ['fullName', 'phoneNumber', 'password', 'confirmPassword'].find((field) => fields[field]);
      if (first) document.getElementById(`google-${first}`)?.focus();
      if (api?.status === 401 || api?.status === 409 && !api.fieldErrors?.phoneNumber) setForm(empty);
    } finally { busy.current = false; }
  };
  const leave = async (switchAccount = false) => {
    if (busy.current) return;
    busy.current = true; setPhase('submitting');
    try {
      if (context) await cancelGoogleOnboarding(context.flowId);
      generation.current++; setForm(empty); setContext(null); setErrors({}); setError(null); setShowPassword(false);
      if (switchAccount) initiateGoogleLogin();
      else { window.history.replaceState(null, '', '/'); setEntry({ status: null, onboarding: false }); }
    } catch (e) {
      setError(e instanceof AuthApiError ? e.message : 'Không thể hủy yêu cầu. Vui lòng thử lại');
      if (e instanceof AuthApiError && (e.status === 401 || e.status === 409)) setContext(null);
      setPhase('failed');
    } finally { busy.current = false; }
  };
  return { isOnboarding: entry.onboarding, context, form, errors, error, phase, googleError,
    showPassword, setShowPassword, change, submit, recover, leave,
    reload: () => { setPhase('loading'); setError(null); setEntry(readEntry()); } };
}
