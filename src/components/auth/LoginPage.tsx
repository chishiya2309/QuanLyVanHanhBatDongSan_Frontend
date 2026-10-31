import type { FC } from 'react';
import { useGoogleAuthCallback } from '../../hooks/useGoogleAuthCallback';
import type { AuthenticatedUserResponse } from '../../types/auth';
import type { AuthNotice } from '../../types/changePassword';
import { GoogleLinkConfirmModal } from './GoogleLinkConfirmModal';
import { LoginForm } from './LoginForm';
import { NarrativePanel } from './NarrativePanel';

interface LoginPageProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: (user: AuthenticatedUserResponse) => void;
  initialLoginName?: string;
  sessionError?: string | null;
  onDismissSessionError?: () => void;
  authNotice?: AuthNotice | null;
  onDismissAuthNotice?: () => void;
  onForgotPassword?: () => void;
}

export const LoginPage: FC<LoginPageProps> = ({
  onNavigateToRegister,
  onLoginSuccess,
  initialLoginName = '',
  sessionError,
  onDismissSessionError,
  authNotice,
  onDismissAuthNotice,
  onForgotPassword,
}) => {
  const {
    isLinkModalOpen,
    googleError,
    linkFormData,
    linkFieldErrors,
    linkGeneralError,
    linkStatus,
    showLinkPassword,
    setShowLinkPassword,
    handleLinkChange,
    handleLinkSubmit,
    handleCloseLinkModal,
  } = useGoogleAuthCallback(onLoginSuccess);

  return (
    <main className="page-shell">
      <div className="auth-container">
        {/* CỘT TRÁI: Thương hiệu & Giá trị nền tảng RentOps */}
        <NarrativePanel />

        {/* CỘT PHẢI: Form Đăng nhập hệ thống */}
        <section className="form-panel" aria-label="Khu vực đăng nhập">
          <LoginForm
            onNavigateToRegister={onNavigateToRegister}
            onSuccess={onLoginSuccess}
            initialLoginName={initialLoginName}
            googleError={googleError}
            sessionError={sessionError}
            onDismissSessionError={onDismissSessionError}
            authNotice={authNotice}
            onDismissAuthNotice={onDismissAuthNotice}
            onForgotPassword={onForgotPassword}
          />
        </section>
      </div>

      {/* Modal Xác nhận liên kết Google (khi status=link_required) */}
      <GoogleLinkConfirmModal
        isOpen={isLinkModalOpen}
        formData={linkFormData}
        fieldErrors={linkFieldErrors}
        generalError={linkGeneralError}
        status={linkStatus}
        showPassword={showLinkPassword}
        onToggleShowPassword={() => setShowLinkPassword((prev) => !prev)}
        onChange={handleLinkChange}
        onSubmit={handleLinkSubmit}
        onClose={handleCloseLinkModal}
      />
    </main>
  );
};
