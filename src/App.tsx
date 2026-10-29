import { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterHostPage } from './components/auth/RegisterHostPage';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { ProfileModal } from './components/profile/ProfileModal';
import { useProfile } from './hooks/useProfile';
import { mockCurrentUser } from './mocks/dashboardMockData';
import { getCurrentUser, logout } from './services/authApi';
import type { AuthenticatedUserResponse } from './types/auth';
import type { UserProfile } from './types/dashboard';
import { profileMessages } from './types/profile';

function AuthenticatedDashboard({ user, onLogout, onSessionExpired }: {
  user: AuthenticatedUserResponse; onLogout: () => void; onSessionExpired: () => void;
}) {
  const profileController = useProfile(onSessionExpired);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
      setIsProfileOpen(true);
      void profileController.fetchProfile();
    }} />
    <ProfileModal isOpen={isProfileOpen} controller={profileController} onClose={() => setIsProfileOpen(false)} />
  </>;
}

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserResponse | null>(null);
  const [prefilledIdentifier, setPrefilledIdentifier] = useState<string>('');
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Khi đăng nhập thành công: Nối tạm trực tiếp vào dashboard hiện có
  const handleAuthSuccess = useCallback((user: AuthenticatedUserResponse) => {
    setSessionError(null);
    setCurrentUser(user);
    setView('dashboard');
  }, []);

  // Tự động kiểm tra phiên đăng nhập hiện tại từ cookie HttpOnly khi mở ứng dụng
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) handleAuthSuccess(user);
      })
      .catch(() => {
        // Chưa có phiên hoặc phiên hết hạn -> Giữ ở view login
      });
    return () => { cancelled = true; };
  }, [handleAuthSuccess]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setView('login');
    void logout().catch(() => undefined);
  }, []);

  const handleSessionExpired = useCallback(() => {
    setSessionError(profileMessages.sessionInvalid);
    handleLogout();
  }, [handleLogout]);

  // 1. Màn hình Dashboard hiện có (Dùng chung tạm thời sau khi đăng nhập thành công)
  if (view === 'dashboard' && currentUser) {
    return (
      <AuthenticatedDashboard
        key={currentUser.accountId}
        user={currentUser}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
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
      onNavigateToRegister={() => setView('register')}
      onLoginSuccess={handleAuthSuccess}
      sessionError={sessionError}
      onDismissSessionError={() => setSessionError(null)}
    />
  );
}
