import type { FC } from 'react';
import { useGoogleAuthCallback } from '../../hooks/useGoogleAuthCallback';
import type { AuthenticatedUserResponse } from '../../types/auth';
import type { AuthNotice } from '../../types/changePassword';
import { GoogleOnboardingForm } from './GoogleOnboardingForm';
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
  const google = useGoogleAuthCallback(onLoginSuccess);

  return (
    <main className="page-shell">
      <div className="auth-container auth-container--login">
        {/* CỘT PHẢI: Form Đăng nhập hệ thống */}
        <section className="form-panel" aria-label="Khu vực đăng nhập">
          <p className="auth-mobile-brand">RentOps<span className="brand-dot">.</span></p>
          {google.isOnboarding ? <GoogleOnboardingForm controller={google} /> : <LoginForm
            onNavigateToRegister={onNavigateToRegister}
            onSuccess={onLoginSuccess}
            initialLoginName={initialLoginName}
            googleError={google.googleError}
            sessionError={sessionError}
            onDismissSessionError={onDismissSessionError}
            authNotice={authNotice}
            onDismissAuthNotice={onDismissAuthNotice}
            onForgotPassword={onForgotPassword}
          />}
        </section>
        <NarrativePanel />
      </div>

    </main>
  );
};
