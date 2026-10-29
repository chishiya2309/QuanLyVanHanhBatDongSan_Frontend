import { useState, type ChangeEvent, type FormEvent } from 'react';
import { validateLoginForm } from '../schemas/loginValidation';
import { AuthApiError, login } from '../services/authApi';
import type {
  AuthenticatedUserResponse,
  LoginFieldErrors,
  LoginFormData,
} from '../types/auth';

export function useLogin(
  initialLoginName = '',
  onSuccessCallback?: (user: AuthenticatedUserResponse) => void
) {
  const [formData, setFormData] = useState<LoginFormData>({
    loginName: initialLoginName,
    password: '',
    rememberMe: true,
  });

  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showPassword, setShowPassword] = useState(false);

  const focusFirstErrorField = (errors: LoginFieldErrors) => {
    const fieldOrder: (keyof LoginFieldErrors)[] = ['loginName', 'password'];
    for (const field of fieldOrder) {
      if (errors[field]) {
        const element = document.getElementById(field);
        if (element) {
          element.focus();
        }
        break;
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Tự động xóa lỗi của trường tương ứng khi người dùng nhập/sửa
    if (fieldErrors[name as keyof LoginFieldErrors]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof LoginFieldErrors];
        return next;
      });
    }

    if (generalError) {
      setGeneralError(null);
    }
  };

  const toggleShowPassword = () => setShowPassword((prev) => !prev);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (status === 'loading') return;

    setGeneralError(null);
    setSuccessMessage(null);

    // 1. Kiểm tra Client-side Validation (ưu tiên rỗng trước)
    const validation = validateLoginForm({
      loginName: formData.loginName,
      password: formData.password,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setStatus('error');
      focusFirstErrorField(validation.errors);
      return;
    }

    // 2. Gửi request lên Backend API
    setStatus('loading');
    setFieldErrors({});

    try {
      const user = await login({
        loginName: formData.loginName,
        password: formData.password,
      });

      setStatus('success');
      setSuccessMessage('Đăng nhập thành công');

      if (onSuccessCallback) {
        setTimeout(() => {
          onSuccessCallback(user);
        }, 600);
      }
    } catch (err) {
      setStatus('error');
      if (err instanceof AuthApiError) {
        const serverFieldErrors = err.fieldErrors || {};
        const hasFieldErrors = Object.keys(serverFieldErrors).length > 0;

        if (hasFieldErrors) {
          setFieldErrors(serverFieldErrors as LoginFieldErrors);
          focusFirstErrorField(serverFieldErrors as LoginFieldErrors);
        }

        if (err.status === 401) {
          setGeneralError('Tên đăng nhập hoặc mật khẩu không chính xác');
        } else if (err.status === 403) {
          setGeneralError(err.message || 'Tài khoản đã bị khóa');
        } else if (!hasFieldErrors || err.status === 500 || err.status === 0) {
          setGeneralError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại sau');
        }
      } else {
        setGeneralError('Đăng nhập không thành công. Vui lòng thử lại sau');
      }
    }
  };

  return {
    formData,
    setFormData,
    fieldErrors,
    generalError,
    setGeneralError,
    successMessage,
    status,
    showPassword,
    handleChange,
    toggleShowPassword,
    handleSubmit,
  };
}
