import { useState, type ChangeEvent, type FormEvent } from 'react';
import { validateRegisterHost } from '../schemas/registerHostValidation';
import { AuthApiError, registerHost } from '../services/authApi';
import type { FormFieldErrors, RegisterHostFormData } from '../types/auth';

const INITIAL_FORM_DATA: RegisterHostFormData = {
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
};

export function useRegisterHost(onSuccessCallback?: (email: string, phone: string) => void) {
  const [formData, setFormData] = useState<RegisterHostFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const focusFirstErrorField = (errors: FormFieldErrors) => {
    const fieldOrder: (keyof RegisterHostFormData)[] = [
      'fullName',
      'email',
      'phoneNumber',
      'password',
      'confirmPassword',
    ];

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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Tự động xóa lỗi của trường tương ứng khi người dùng bắt đầu chỉnh sửa
    if (fieldErrors[name as keyof RegisterHostFormData]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof RegisterHostFormData];
        return next;
      });
    }

    if (generalError) {
      setGeneralError(null);
    }
  };

  const toggleShowPassword = () => setShowPassword((prev) => !prev);
  const toggleShowConfirmPassword = () => setShowConfirmPassword((prev) => !prev);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (status === 'loading') return;

    setGeneralError(null);
    setSuccessMessage(null);

    // 1. Kiểm tra tính hợp lệ phía Client
    const validation = validateRegisterHost(formData);
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
      const response = await registerHost(formData);
      setStatus('success');
      setSuccessMessage(response.message || 'Đăng ký tài khoản Host thành công');

      // Tự động chuyển hướng hoặc gọi callback sau 1.5 giây
      if (onSuccessCallback) {
        setTimeout(() => {
          onSuccessCallback(formData.email.trim(), formData.phoneNumber.trim());
        }, 1500);
      }
    } catch (err) {
      setStatus('error');
      if (err instanceof AuthApiError) {
        const serverFieldErrors = err.fieldErrors || {};
        const hasFieldErrors = Object.keys(serverFieldErrors).length > 0;

        if (hasFieldErrors) {
          setFieldErrors(serverFieldErrors);
          focusFirstErrorField(serverFieldErrors);
        }

        if (err.status === 500 || err.status === 0 || !hasFieldErrors) {
          setGeneralError(err.message || 'Đăng ký không thành công. Vui lòng thử lại sau');
        }
      } else {
        setGeneralError('Đăng ký không thành công. Vui lòng thử lại sau');
      }
    }
  };

  return {
    formData,
    fieldErrors,
    generalError,
    successMessage,
    status,
    showPassword,
    showConfirmPassword,
    handleChange,
    toggleShowPassword,
    toggleShowConfirmPassword,
    handleSubmit,
  };
}
