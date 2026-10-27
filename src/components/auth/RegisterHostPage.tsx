import type { FC } from 'react';
import { NarrativePanel } from './NarrativePanel';
import { RegisterHostForm } from './RegisterHostForm';

interface RegisterHostPageProps {
  onNavigateToLogin: () => void;
  onSuccess?: (email: string, phone: string) => void;
}

export const RegisterHostPage: FC<RegisterHostPageProps> = ({
  onNavigateToLogin,
  onSuccess,
}) => {
  return (
    <main className="page-shell">
      <div className="auth-container">
        <NarrativePanel />
        <section className="form-panel form-panel-register" aria-label="Khung đăng ký tài khoản Host">
          <RegisterHostForm
            onNavigateToLogin={onNavigateToLogin}
            onSuccess={onSuccess}
          />
        </section>
      </div>
    </main>
  );
};
