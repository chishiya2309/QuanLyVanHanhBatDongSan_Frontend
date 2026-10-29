import { useEffect, useState } from 'react';
import {
  AuthApiError,
  getCurrentUser,
  linkGoogleAccount,
} from '../services/authApi';
import type {
  AuthenticatedUserResponse,
  GoogleLinkFormData,
  LoginFieldErrors,
} from '../types/auth';

export function useGoogleAuthCallback(
  onLoginSuccess?: (user: AuthenticatedUserResponse) => void
) {
  // Khởi tạo state trực tiếp từ URL query params để tránh cascading render
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('status') === 'link_required';
  });

  const [googleError, setGoogleError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const status = new URLSearchParams(window.location.search).get('status');
    if (status === 'account_locked') return 'Tài khoản đã bị khóa';
    if (status === 'error') return 'Không thể đăng nhập bằng Google. Vui lòng thử lại sau';
    return null;
  });

  // Trạng thái modal liên kết
  const [linkFormData, setLinkFormData] = useState<GoogleLinkFormData>({
    loginName: '',
    password: '',
  });
  const [linkFieldErrors, setLinkFieldErrors] = useState<LoginFieldErrors>({});
  const [linkGeneralError, setLinkGeneralError] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showLinkPassword, setShowLinkPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (!status) return;

    // Dọn sạch URL query parameter bằng replaceState để tránh kích hoạt lại khi refresh
    window.history.replaceState({}, document.title, window.location.pathname);

    // Xử lý luồng đăng nhập Google thành công
    if (status === 'success') {
      getCurrentUser()
        .then((user) => {
          if (onLoginSuccess) {
            onLoginSuccess(user);
          }
        })
        .catch(() => {
          setGoogleError('Không thể đăng nhập bằng Google. Vui lòng thử lại sau');
        });
    }
  }, [onLoginSuccess]);

  const handleLinkChange = (field: 'loginName' | 'password', value: string) => {
    setLinkFormData((prev) => ({ ...prev, [field]: value }));
    if (linkFieldErrors[field]) {
      setLinkFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (linkGeneralError) {
      setLinkGeneralError(null);
    }
  };

  const handleLinkSubmit = async () => {
    if (linkStatus === 'loading') return;

    setLinkGeneralError(null);

    // Kiểm tra hợp lệ phía client
    const errors: LoginFieldErrors = {};
    if (!linkFormData.loginName || !linkFormData.loginName.trim()) {
      errors.loginName = 'Vui lòng nhập tên đăng nhập';
    }
    if (!linkFormData.password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    }

    if (Object.keys(errors).length > 0) {
      setLinkFieldErrors(errors);
      setLinkStatus('error');
      return;
    }

    setLinkStatus('loading');
    setLinkFieldErrors({});

    try {
      const user = await linkGoogleAccount({
        loginName: linkFormData.loginName,
        password: linkFormData.password,
      });

      setLinkStatus('success');
      setTimeout(() => {
        setIsLinkModalOpen(false);
        if (onLoginSuccess) {
          onLoginSuccess(user);
        }
      }, 500);
    } catch (err) {
      setLinkStatus('error');
      if (err instanceof AuthApiError) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setLinkFieldErrors(err.fieldErrors as LoginFieldErrors);
        }

        if (err.status === 401) {
          setLinkGeneralError(err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác');
        } else if (err.status === 403) {
          setLinkGeneralError(err.message || 'Tài khoản đã bị khóa');
        } else if (err.status === 409) {
          setLinkGeneralError('Không thể liên kết tài khoản Google này');
        } else {
          setLinkGeneralError(err.message || 'Đăng nhập không thành công. Vui lòng thử lại sau');
        }
      } else {
        setLinkGeneralError('Đăng nhập không thành công. Vui lòng thử lại sau');
      }
    }
  };

  const handleCloseLinkModal = () => {
    setIsLinkModalOpen(false);
    setLinkFormData({ loginName: '', password: '' });
    setLinkFieldErrors({});
    setLinkGeneralError(null);
    setLinkStatus('idle');
  };

  return {
    isLinkModalOpen,
    googleError,
    setGoogleError,
    linkFormData,
    linkFieldErrors,
    linkGeneralError,
    linkStatus,
    showLinkPassword,
    setShowLinkPassword,
    handleLinkChange,
    handleLinkSubmit,
    handleCloseLinkModal,
  };
}
