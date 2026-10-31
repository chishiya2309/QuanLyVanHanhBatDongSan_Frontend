import { useEffect, useRef, useState } from 'react';
import { validateChangePassword } from '../schemas/changePasswordValidation';
import { AuthApiError, changePassword } from '../services/authApi';
import {
  changePasswordFields, changePasswordMessages as m,
  type AuthNotice, type ChangePasswordField, type ChangePasswordFieldErrors,
  type ChangePasswordFormData, type ChangePasswordStatus,
} from '../types/changePassword';

const emptyForm = (): ChangePasswordFormData => ({ currentPassword: '', newPassword: '', confirmPassword: '' });

export function useChangePassword(onAuthenticationEnded: (notice: AuthNotice) => void) {
  const [formData, setFormData] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordFieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ChangePasswordField, boolean>>>({});
  const [visibleFields, setVisibleFields] = useState<Partial<Record<ChangePasswordField, boolean>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChangePasswordStatus>('idle');
  const [focusRequest, setFocusRequest] = useState(0);
  const submitted = useRef(false);
  const pending = useRef(false);
  const alive = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const requestGeneration = generation;
    alive.current = true;
    return () => { alive.current = false; requestGeneration.current++; };
  }, []);

  const handleChange = (field: ChangePasswordField, value: string) => {
    if (pending.current || status === 'forbidden') return;
    const next = { ...formData, [field]: value };
    setFormData(next);
    setGeneralError(null);
    const validation = validateChangePassword(next);
    setFieldErrors((previous) => {
      const errors = { ...previous };
      const update = (key: ChangePasswordField) => {
        if (submitted.current || touched[key]) {
          if (validation[key]) errors[key] = validation[key]; else delete errors[key];
        } else delete errors[key];
      };
      update(field);
      if (field === 'newPassword') update('confirmPassword');
      return errors;
    });
  };

  const handleBlur = (field: ChangePasswordField) => {
    if (pending.current) return;
    setTouched((previous) => ({ ...previous, [field]: true }));
    const error = validateChangePassword(formData)[field];
    setFieldErrors((previous) => {
      const next = { ...previous };
      if (error) next[field] = error; else delete next[field];
      return next;
    });
  };

  const toggleVisibility = (field: ChangePasswordField) => {
    if (!pending.current) setVisibleFields((previous) => ({ ...previous, [field]: !previous[field] }));
  };

  const handleSubmit = async () => {
    if (pending.current || status === 'forbidden' || status === 'success') return;
    submitted.current = true;
    setGeneralError(null);
    const errors = validateChangePassword(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setStatus('error');
      setFocusRequest((value) => value + 1);
      return;
    }
    pending.current = true;
    const request = ++generation.current;
    setStatus('submitting');
    try {
      await changePassword(formData);
      if (!alive.current || request !== generation.current) return;
      setFormData(emptyForm());
      setVisibleFields({});
      setStatus('success');
      onAuthenticationEnded({ kind: 'success', message: m.success });
    } catch (error) {
      if (!alive.current || request !== generation.current) return;
      const apiError = error instanceof AuthApiError ? error : new AuthApiError(0, m.failure);
      if (apiError.status === 401) {
        setFormData(emptyForm());
        setVisibleFields({});
        onAuthenticationEnded({ kind: 'error', message: m.sessionInvalid });
        return;
      }
      if (apiError.status === 403 && apiError.message === m.forbidden) {
        setFormData(emptyForm());
        setVisibleFields({});
        setStatus('forbidden');
        setGeneralError(m.forbidden);
      } else {
        const serverErrors: ChangePasswordFieldErrors = {};
        if (apiError.status === 400) for (const field of changePasswordFields) {
          if (apiError.fieldErrors?.[field]) serverErrors[field] = apiError.fieldErrors[field];
        }
        setFieldErrors(serverErrors);
        setGeneralError(Object.keys(serverErrors).length ? null : apiError.message);
        setStatus('error');
      }
      setFocusRequest((value) => value + 1);
    } finally {
      if (alive.current && request === generation.current) pending.current = false;
    }
  };

  return { formData, fieldErrors, touched, visibleFields, generalError, status, focusRequest, handleChange, handleBlur, toggleVisibility, handleSubmit };
}
