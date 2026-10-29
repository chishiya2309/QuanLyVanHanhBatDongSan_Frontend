import { useState, useEffect, useMemo, useCallback } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterHostPage } from './components/auth/RegisterHostPage';
import { DashboardShell } from './components/dashboard/DashboardShell';
import { mockCurrentUser } from './mocks/dashboardMockData';
import { getCurrentUser, logout } from './services/authApi';
import type { AuthenticatedUserResponse } from './types/auth';
import type { UserProfile } from './types/dashboard';

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserResponse | null>(null);
  const [prefilledIdentifier, setPrefilledIdentifier] = useState<string>('');

  // Khi đăng nhập thành công: Nối tạm trực tiếp vào dashboard hiện có
  const handleAuthSuccess = useCallback((user: AuthenticatedUserResponse) => {
    setCurrentUser(user);
    setView('dashboard');
  }, []);

  // Tự động kiểm tra phiên đăng nhập hiện tại từ cookie HttpOnly khi mở ứng dụng
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        handleAuthSuccess(user);
      })
      .catch(() => {
        // Chưa có phiên hoặc phiên hết hạn -> Giữ ở view login
      });
  }, [handleAuthSuccess]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Bỏ qua lỗi logout phía client
    } finally {
      setCurrentUser(null);
      setView('login');
    }
  };

  // Map user data cho DashboardShell hiện có
  const activeUserProfile: UserProfile = useMemo(() => {
    if (!currentUser) return mockCurrentUser;
    return {
      ...mockCurrentUser,
      id: currentUser.accountId,
      fullName: currentUser.loginName || mockCurrentUser.fullName,
      email: `${currentUser.loginName || 'user'}@rentops.vn`,
      role: currentUser.role === 'ADMIN' ? 'MANAGER' : 'LANDLORD',
    };
  }, [currentUser]);

  // 1. Màn hình Dashboard hiện có (Dùng chung tạm thời sau khi đăng nhập thành công)
  if (view === 'dashboard') {
    return (
      <DashboardShell
        user={activeUserProfile}
        onLogout={handleLogout}
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
    />
  );
}
