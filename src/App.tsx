import { useState, useEffect, useCallback, useRef } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterHostPage } from './components/auth/RegisterHostPage';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { ProfileModal } from './components/profile/ProfileModal';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { ForgotPasswordPage, ResetPasswordPage } from './components/auth/PasswordRecoveryPage';
import { captureRecoveryEntry, recoveryPath, type RecoveryBootstrap } from './utils/recoveryNavigation';
import type { RecoveryEntry } from './types/passwordRecovery';
import { useProfile } from './hooks/useProfile';
import { mockCurrentUser } from './mocks/dashboardMockData';
import { clearCsrfCache, getCurrentUser, logout } from './services/authApi';
import type { AuthNotice } from './types/changePassword';
import type { AuthenticatedUserResponse } from './types/auth';
import type { UserProfile } from './types/dashboard';
import { profileMessages } from './types/profile';

function AuthenticatedDashboard({ user, onLogout, onSessionExpired, onAuthenticationEnded }: {
  user: AuthenticatedUserResponse; onLogout: () => void; onSessionExpired: () => void;
  onAuthenticationEnded: (notice: AuthNotice) => void;
}) {
  const profileController = useProfile(onSessionExpired);
  const [accountModal, setAccountModal] = useState<'profile' | 'password' | null>(null);
  const [focusChangePassword, setFocusChangePassword] = useState(false);
  const profile = profileController.profile;
  const activeUserProfile: UserProfile = {
    id: user.accountId,
    fullName: profile ? profile.role === 'HOST' ? profile.businessName : profile.fullName : user.loginName,
    email: profile?.email || '',
    phoneNumber: profile?.phoneNumber || '',
    avatarUrl: profile?.role === 'HOST' ? profile.logoUrl || undefined : undefined,
    role: user.role,
    managedProperties: mockCurrentUser.managedProperties,
  };
  return <>
    <DashboardShell user={activeUserProfile} onLogout={onLogout} onOpenProfile={() => {
      setFocusChangePassword(false);
      setAccountModal('profile');
      void profileController.fetchProfile();
    }} />
    <ProfileModal isOpen={accountModal === 'profile'} controller={profileController} onClose={() => setAccountModal(null)}
      focusChangePassword={focusChangePassword} onOpenChangePassword={() => setAccountModal('password')} />
    {accountModal === 'password' && <ChangePasswordModal onAuthenticationEnded={onAuthenticationEnded} onClose={() => {
      setFocusChangePassword(true);
      setAccountModal('profile');
    }} />}
  </>;
}

export default function App({ initialRecovery }: { initialRecovery?: RecoveryBootstrap }) {
  const [recovery, setRecovery] = useState<RecoveryEntry>(() => initialRecovery ? initialRecovery.read() : { path: recoveryPath(window.location.pathname), token: null });
  const recoveryRoute = useRef(recovery.path);
  const [recoveryVisit, setRecoveryVisit] = useState(0);
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserResponse | null>(null);
  const [prefilledIdentifier, setPrefilledIdentifier] = useState<string>('');
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const authGeneration = useRef(0);

  // Khi đăng nhập thành công: Nối tạm trực tiếp vào dashboard hiện có
  const handleAuthSuccess = useCallback((user: AuthenticatedUserResponse) => {
    if (recoveryRoute.current) return;
    authGeneration.current++;
    setAuthNotice(null);
    setCurrentUser(user);
    setView('dashboard');
  }, []);

  // Tự động kiểm tra phiên đăng nhập hiện tại từ cookie HttpOnly khi mở ứng dụng
  useEffect(() => {
    if (recoveryRoute.current) return;
    let cancelled = false;
    const generation = authGeneration.current;
    getCurrentUser()
      .then((user) => {
        if (!cancelled && generation === authGeneration.current) handleAuthSuccess(user);
      })
      .catch(() => {
        // Chưa có phiên hoặc phiên hết hạn -> Giữ ở view login
      });
    return () => { cancelled = true; };
  }, [handleAuthSuccess]);

  useEffect(() => {
    initialRecovery?.release();
    const onPopState = () => {
      const next = captureRecoveryEntry();
      recoveryRoute.current = next.path;
      authGeneration.current++;
      setRecovery(next); setRecoveryVisit((n) => n + 1);
      setCurrentUser(null); setView('login'); setAuthNotice(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialRecovery]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setRecovery((entry) => entry.token ? { ...entry, token: null } : entry);
    });
    return () => { cancelled = true; };
  }, [recoveryVisit]);

  const resetAuthentication = useCallback((notice: AuthNotice | null = null) => {
    authGeneration.current++;
    clearCsrfCache();
    setCurrentUser(null);
    setView('login');
    setAuthNotice(notice);
  }, []);

  const handleLogout = useCallback(() => {
    resetAuthentication();
    void logout().catch(() => undefined);
  }, [resetAuthentication]);

  const handleSessionExpired = useCallback(() => {
    resetAuthentication({ kind: 'error', message: profileMessages.sessionInvalid });
  }, [resetAuthentication]);

  const handleAuthenticationEnded = useCallback((notice: AuthNotice) => {
    setPrefilledIdentifier(currentUser?.loginName || '');
    resetAuthentication(notice);
  }, [currentUser, resetAuthentication]);

  const navigateRecovery = (path: RecoveryEntry['path']) => {
    authGeneration.current++;
    recoveryRoute.current = path;
    window.history.pushState(null, '', path || '/');
    setRecovery({ path, token: null }); setRecoveryVisit((n) => n + 1);
    setCurrentUser(null); setView('login'); setAuthNotice(null);
  };
  const finishRecovery = (notice: AuthNotice) => {
    recoveryRoute.current = null;
    window.history.replaceState(null, '', '/');
    setRecovery({ path: null, token: null }); setPrefilledIdentifier('');
    resetAuthentication(notice);
  };

  if (recovery.path === '/forgot-password') return <ForgotPasswordPage key={recoveryVisit} onLogin={() => navigateRecovery(null)} />;
  if (recovery.path === '/reset-password') return <ResetPasswordPage key={recoveryVisit} token={recovery.token}
    onLogin={() => navigateRecovery(null)} onNewRequest={() => navigateRecovery('/forgot-password')} onSuccess={finishRecovery} />;

  // 1. Màn hình Dashboard hiện có (Dùng chung tạm thời sau khi đăng nhập thành công)
  if (view === 'dashboard' && currentUser) {
    return (
      <AuthenticatedDashboard
        key={currentUser.accountId}
        user={currentUser}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
        onAuthenticationEnded={handleAuthenticationEnded}
      />
    );
  }

  // 2. Màn hình Đăng ký tài khoản Host
  if (view === 'register') {
    return (
      <RegisterHostPage
        onNavigateToLogin={() => setView('login')}
        onSuccess={(registeredEmail) => {
          setPrefilledIdentifier(registeredEmail);
          setView('login');
        }}
      />
    );
  }

  // 3. Màn hình Đăng nhập (Mặc định)
  return (
    <LoginPage
      initialLoginName={prefilledIdentifier}
      onNavigateToRegister={() => { setAuthNotice(null); setView('register'); }}
      onLoginSuccess={handleAuthSuccess}
      authNotice={authNotice}
      onDismissAuthNotice={() => setAuthNotice(null)}
      onForgotPassword={() => navigateRecovery('/forgot-password')}
    />
  );
}
