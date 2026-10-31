import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthApiError } from '../services/authApi';
import { requestPasswordReset, resetPassword, validatePasswordResetToken } from '../services/passwordRecoveryApi';
import { validateRecoveryEmail, validateResetPassword } from '../schemas/passwordRecoveryValidation';
import { recoveryMessages as m, type RecoveryFieldErrors, type ResetPasswordField, type ResetPasswordFormData } from '../types/passwordRecovery';
import type { AuthNotice } from '../types/changePassword';

function useRequestLifetime() {
  const aliveRef = useRef(false);
  const generationRef = useRef(0);
  useEffect(() => {
    const requests = generationRef;
    aliveRef.current = true;
    return () => { aliveRef.current = false; requests.current++; };
  }, []);
  return { aliveRef, generationRef };
}

export function useForgotPassword() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RecoveryFieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'accepted' | 'error'>('idle');
  const [focusRequest, setFocusRequest] = useState(0);
  const interacted = useRef(false);
  const pending = useRef(false);
  const { aliveRef, generationRef } = useRequestLifetime();
  const handleChange = (value: string) => {
    if (pending.current) return;
    setEmail(value); setGeneralError(null);
    setFieldErrors(interacted.current ? validateRecoveryEmail(value) : {});
  };
  const handleBlur = () => { interacted.current = true; setFieldErrors(validateRecoveryEmail(email)); };
  const handleSubmit = async () => {
    if (pending.current || status === 'accepted') return;
    interacted.current = true; setGeneralError(null);
    const errors = validateRecoveryEmail(email); setFieldErrors(errors);
    if (errors.email) { setFocusRequest((n) => n + 1); return; }
    pending.current = true; setStatus('submitting');
    const request = ++generationRef.current;
    try {
      await requestPasswordReset({ email });
      if (!aliveRef.current || generationRef.current !== request) return;
      setEmail(''); setStatus('accepted'); setFocusRequest((n) => n + 1);
    } catch (error) {
      if (!aliveRef.current || generationRef.current !== request) return;
      const api = error instanceof AuthApiError ? error : new AuthApiError(0, m.failure);
      setFieldErrors(api.fieldErrors || {});
      setGeneralError(api.fieldErrors?.email ? null : api.message);
      setStatus('error'); setFocusRequest((n) => n + 1);
    } finally { if (aliveRef.current && generationRef.current === request) pending.current = false; }
  };
  const startAgain = () => {
    setEmail(''); setFieldErrors({}); setGeneralError(null); setStatus('idle'); interacted.current = false;
    setFocusRequest((n) => n + 1);
  };
  return { email, fieldErrors, generalError, status, focusRequest, handleChange, handleBlur, handleSubmit, startAgain };
}

const emptyPasswords = (): ResetPasswordFormData => ({ newPassword: '', confirmPassword: '' });

export function useResetPassword(initialToken: string | null, onSuccess: (notice: AuthNotice) => void) {
  const token = useRef(initialToken);
  const [verification, setVerification] = useState<'checking' | 'valid' | 'invalid' | 'failed'>(initialToken ? 'checking' : 'invalid');
  const [formData, setFormData] = useState(emptyPasswords);
  const [fieldErrors, setFieldErrors] = useState<RecoveryFieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(initialToken ? null : m.linkInvalid);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'success'>('idle');
  const [visible, setVisible] = useState<Partial<Record<ResetPasswordField, boolean>>>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const touched = useRef<Partial<Record<ResetPasswordField, boolean>>>({});
  const submitted = useRef(false);
  const pending = useRef(false);
  const { aliveRef, generationRef } = useRequestLifetime();

  const verify = useCallback(async () => {
    if (!token.current || pending.current) return;
    pending.current = true;
    const request = ++generationRef.current;
    setVerification('checking'); setGeneralError(null);
    try {
      await validatePasswordResetToken(token.current);
      if (!aliveRef.current || generationRef.current !== request) return;
      setVerification('valid'); setFocusRequest((n) => n + 1);
    } catch (error) {
      if (!aliveRef.current || generationRef.current !== request) return;
      const message = error instanceof AuthApiError ? error.message : m.failure;
      if (message === m.linkInvalid) { token.current = null; setVerification('invalid'); }
      else setVerification('failed');
      setGeneralError(message); setFocusRequest((n) => n + 1);
    } finally { if (aliveRef.current && generationRef.current === request) pending.current = false; }
  }, [aliveRef, generationRef]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void verify(); });
    return () => { cancelled = true; };
  }, [verify]);

  const handleChange = (field: ResetPasswordField, value: string) => {
    if (pending.current || verification !== 'valid') return;
    const next = { ...formData, [field]: value }; setFormData(next); setGeneralError(null);
    const validation = validateResetPassword(next);
    setFieldErrors((previous) => {
      const errors = { ...previous };
      for (const key of ['newPassword', 'confirmPassword'] as const) {
        if (key !== field && !(field === 'newPassword' && key === 'confirmPassword')) continue;
        if (submitted.current || touched.current[key]) {
          if (validation[key]) errors[key] = validation[key]; else delete errors[key];
        } else delete errors[key];
      }
      return errors;
    });
  };
  const handleBlur = (field: ResetPasswordField) => {
    if (pending.current) return;
    touched.current[field] = true;
    const error = validateResetPassword(formData)[field];
    setFieldErrors((previous) => { const next = { ...previous }; if (error) next[field] = error; else delete next[field]; return next; });
  };
  const toggleVisibility = (field: ResetPasswordField) => {
    if (!pending.current) setVisible((previous) => ({ ...previous, [field]: !previous[field] }));
  };
  const handleSubmit = async () => {
    if (pending.current || verification !== 'valid' || !token.current || status === 'success') return;
    submitted.current = true; setGeneralError(null);
    const errors = validateResetPassword(formData); setFieldErrors(errors);
    if (Object.keys(errors).length) { setFocusRequest((n) => n + 1); return; }
    pending.current = true; setStatus('submitting');
    const request = ++generationRef.current;
    try {
      await resetPassword({ token: token.current, ...formData });
      if (!aliveRef.current || generationRef.current !== request) return;
      token.current = null; setFormData(emptyPasswords()); setVisible({}); setStatus('success');
      onSuccess({ kind: 'success', message: m.success });
    } catch (error) {
      if (!aliveRef.current || generationRef.current !== request) return;
      const api = error instanceof AuthApiError ? error : new AuthApiError(0, m.failure);
      if (api.message === m.requestInvalid) {
        token.current = null; setFormData(emptyPasswords()); setVisible({}); setVerification('invalid');
      }
      setFieldErrors(api.fieldErrors || {});
      setGeneralError(Object.keys(api.fieldErrors || {}).length ? null : api.message);
      setStatus('error'); setFocusRequest((n) => n + 1);
    } finally { if (aliveRef.current && generationRef.current === request) pending.current = false; }
  };
  return { verification, formData, fieldErrors, generalError, status, visible, focusRequest, verify, handleChange, handleBlur, toggleVisibility, handleSubmit };
}
