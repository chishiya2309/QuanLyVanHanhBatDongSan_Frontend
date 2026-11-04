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
import { AuthApiError, clearCsrfCache, getCurrentUser, logout } from './services/authApi';
import type { AuthNotice } from './types/changePassword';
import type { AuthenticatedUserResponse } from './types/auth';
import type { UserProfile } from './types/dashboard';
import { profileMessages } from './types/profile';
import { HostAccountsPage, HostAccountsForbidden } from './components/admin/HostAccountsPage';
import { parseHostAccountRoute } from './utils/hostAccountNavigation';
import { HOST_ACCOUNTS_PATH, hostAccountMessages, type HostAccountRoute } from './types/hostAccounts';
import { AssetsPage, AssetsForbidden } from './components/assets/AssetsPage';
import { assetMessages, type AssetRoute } from './types/assets';
import { invalidateSession, onSessionChange, rememberSession } from './services/sessionClient';
import { assetRouteKey, parseAssetRoute } from './utils/assetNavigation';

function isGoogleEntry(): boolean {
  return window.location.pathname === '/auth/onboarding' || window.location.pathname === '/auth/callback'
    || new URLSearchParams(window.location.search).has('status');
}

function AuthenticatedDashboard({ user, onLogout, onSessionExpired, onAuthenticationEnded, hostRoute, onNavigateHost, assetRoute, onNavigateAssets, onCreatePendingChange, onOverview }: {
  user: AuthenticatedUserResponse; onLogout: () => void; onSessionExpired: () => void;
  onAuthenticationEnded: (notice: AuthNotice) => void;
  hostRoute: HostAccountRoute | null; onNavigateHost: (id: string | null) => void; onOverview: () => void;
  assetRoute: AssetRoute | null; onNavigateAssets: (url: string, replace?: boolean) => void;
  onCreatePendingChange: (pending: boolean) => void;
}) {
  const profileController = useProfile(onSessionExpired);
  const [accountModal, setAccountModal] = useState<'profile' | 'password' | null>(null);
  const [focusChangePassword, setFocusChangePassword] = useState(false);
  const [adminDenied, setAdminDenied] = useState(false);
  const [assetsDenied, setAssetsDenied] = useState(false);
  const denyAdmin = useCallback(() => { setAccountModal(null); setAdminDenied(true); }, []);
  const denyAssets = useCallback(() => { setAccountModal(null); setAssetsDenied(true); }, []);
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
    }} hostAccountsActive={hostRoute !== null} showHostAccounts={user.role === 'ADMIN' && !adminDenied}
      assetsActive={assetRoute !== null} showAssets={user.role === 'HOST' && !assetsDenied} onNavigateAssets={() => onNavigateAssets('/assets')}
      onNavigateOverview={onOverview} onNavigateHostAccounts={() => onNavigateHost(null)}>
      {assetRoute ? (user.role !== 'HOST' || assetsDenied ? <AssetsForbidden onOverview={onOverview} /> :
        <AssetsPage route={assetRoute} onNavigate={onNavigateAssets} onCreatePendingChange={onCreatePendingChange}
          onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: assetMessages.sessionInvalid })} onForbidden={denyAssets} />) : hostRoute && (user.role !== 'ADMIN' || adminDenied
        ? <HostAccountsForbidden onOverview={onOverview} />
        : <HostAccountsPage accountId={hostRoute.accountId} onNavigate={onNavigateHost}
          onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: hostAccountMessages.sessionInvalid })} onForbidden={denyAdmin} />)}
    </DashboardShell>
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
  const pendingCreateUrl = useRef<string | null>(null);
  const handleCreatePendingChange = useCallback((pending: boolean) => { pendingCreateUrl.current = pending ? window.location.pathname + window.location.search : null; }, []);
  const [hostRoute, setHostRoute] = useState<HostAccountRoute | null>(() => parseHostAccountRoute(window.location.pathname));
  const [assetRoute, setAssetRoute] = useState<AssetRoute | null>(() => parseAssetRoute(window.location.pathname, window.location.search));
  const googleEntry = useRef(isGoogleEntry());
  const [authCheck, setAuthCheck] = useState<'checking' | 'ready' | 'error'>(() => isGoogleEntry() ? 'ready' : 'checking');
  const [authRetry, setAuthRetry] = useState(0);

  // Khi đăng nhập thành công: Nối tạm trực tiếp vào dashboard hiện có
  const handleAuthSuccess = useCallback((user: AuthenticatedUserResponse) => {
    if (recoveryRoute.current) return;
    authGeneration.current++;
    googleEntry.current = false;
    if (window.location.pathname === '/auth/onboarding' || window.location.pathname === '/auth/callback') window.history.replaceState(null, '', '/');
    clearCsrfCache();
    rememberSession(user);
    setAuthNotice(null);
    setCurrentUser(user);
    setAuthCheck('ready');
    setView('dashboard');
  }, []);

  // Tự động kiểm tra phiên đăng nhập hiện tại từ cookie HttpOnly khi mở ứng dụng
  useEffect(() => {
    if (recoveryRoute.current || googleEntry.current) return;
    const controller = new AbortController();
    let cancelled = false;
    const generation = authGeneration.current;
    getCurrentUser({ signal: controller.signal })
      .then((user) => {
        if (!cancelled && generation === authGeneration.current) handleAuthSuccess(user);
      })
      .catch((error: unknown) => {
        if (cancelled || generation !== authGeneration.current) return;
        const assets = parseAssetRoute(window.location.pathname, window.location.search);
        if (!(error instanceof AuthApiError) || error.status !== 401) {
          setAuthCheck('error'); return;
        }
        setAuthCheck('ready');
        if (parseHostAccountRoute(window.location.pathname) || assets) {
          window.history.replaceState(null, '', '/'); setHostRoute(null); setAssetRoute(null);
          setAuthNotice({ kind: 'error', message: assets ? assetMessages.sessionInvalid : hostAccountMessages.sessionInvalid });
        }
      });
    return () => { cancelled = true; controller.abort(); };
  }, [handleAuthSuccess, authRetry]);

  useEffect(() => {
    initialRecovery?.release();
    const onPopState = () => {
      if (pendingCreateUrl.current) { window.history.pushState(null, '', pendingCreateUrl.current); return; }
      const next = captureRecoveryEntry();
      const wasRecovery = recoveryRoute.current !== null;
      recoveryRoute.current = next.path;
      setHostRoute(parseHostAccountRoute(window.location.pathname));
      setAssetRoute(parseAssetRoute(window.location.pathname, window.location.search));
      // Private navigation preserves the authenticated user and pending session check.
      if (!next.path && !wasRecovery) return;
      authGeneration.current++;
      setRecovery(next); setRecoveryVisit((n) => n + 1);
      setCurrentUser(null); setView('login'); setAuthNotice(null);
      if (!next.path && (parseHostAccountRoute(window.location.pathname) || parseAssetRoute(window.location.pathname, window.location.search))) {
        setAuthCheck('checking'); setAuthRetry((n) => n + 1);
      } else setAuthCheck('ready');
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
    invalidateSession();
    pendingCreateUrl.current = null;
    clearCsrfCache();
    setCurrentUser(null);
    setView('login');
    setAuthNotice(notice);
    setAuthCheck('ready');
    if (parseHostAccountRoute(window.location.pathname) || parseAssetRoute(window.location.pathname, window.location.search)) { window.history.replaceState(null, '', '/'); setHostRoute(null); setAssetRoute(null); }
  }, []);

  useEffect(() => onSessionChange((event) => {
    resetAuthentication({ kind: 'error', message: 'Phiên đăng nhập đã thay đổi ở tab khác. Vui lòng tiếp tục với phiên hiện tại.' });
    if (event.accountId) { googleEntry.current = false; setAuthCheck('checking'); setAuthRetry((n) => n + 1); }
  }), [resetAuthentication]);

  const handleLogout = useCallback(() => {
    resetAuthentication();
    void logout().catch(() => undefined);
  }, [resetAuthentication]);

  const handleSessionExpired = useCallback(() => {
    resetAuthentication({ kind: 'error', message: parseAssetRoute(window.location.pathname, window.location.search) ? assetMessages.sessionInvalid : profileMessages.sessionInvalid });
  }, [resetAuthentication]);

  const handleAuthenticationEnded = useCallback((notice: AuthNotice) => {
    setPrefilledIdentifier(currentUser?.loginName || '');
    resetAuthentication(notice);
  }, [currentUser, resetAuthentication]);

  const navigateRecovery = (path: RecoveryEntry['path']) => {
    authGeneration.current++;
    invalidateSession();
    googleEntry.current = false;
    recoveryRoute.current = path;
    window.history.pushState(null, '', path || '/');
    setRecovery({ path, token: null }); setRecoveryVisit((n) => n + 1);
    setCurrentUser(null); setView('login'); setAuthNotice(null);
    setHostRoute(null); setAssetRoute(null); setAuthCheck('ready');
  };
  const finishRecovery = (notice: AuthNotice) => {
    recoveryRoute.current = null;
    window.history.replaceState(null, '', '/');
    setRecovery({ path: null, token: null }); setPrefilledIdentifier('');
    resetAuthentication(notice);
  };
  const navigateHost = useCallback((id: string | null) => {
    const path = HOST_ACCOUNTS_PATH + (id === null ? '' : '/' + encodeURIComponent(id));
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setHostRoute({ accountId: id });
    setAssetRoute(null);
  }, []);
  const navigateOverview = useCallback(() => {
    if (window.location.pathname !== '/') window.history.pushState(null, '', '/');
    setHostRoute(null);
    setAssetRoute(null);
  }, []);
  const navigateAssets = useCallback((url: string, replace = false) => {
    const target = new URL(url, window.location.origin);
    const next = parseAssetRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin) return;
    const canonical = assetRouteKey(next);
    if (window.location.pathname + window.location.search !== canonical) {
      if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
    }
    setHostRoute(null); setAssetRoute(next);
  }, []);
  useEffect(() => {
    if (!assetRoute) return;
    const canonical = assetRouteKey(assetRoute);
    if (window.location.pathname + window.location.search !== canonical) window.history.replaceState(null, '', canonical);
  }, [assetRoute]);

  if (recovery.path === '/forgot-password') return <ForgotPasswordPage key={recoveryVisit} onLogin={() => navigateRecovery(null)} />;
  if (recovery.path === '/reset-password') return <ResetPasswordPage key={recoveryVisit} token={recovery.token}
    onLogin={() => navigateRecovery(null)} onNewRequest={() => navigateRecovery('/forgot-password')} onSuccess={finishRecovery} />;

  if (authCheck !== 'ready') return <main className="host-boot">
    <h1>{assetRoute ? 'Quản lý tài sản' : hostRoute ? 'Quản lý tài khoản Host' : 'RentOps'}</h1>
    {authCheck === 'checking' ? <p role="status">Đang kiểm tra phiên đăng nhập</p> : <><p role="alert">{assetRoute ? assetMessages.listFailure : hostRoute ? hostAccountMessages.listFailure : 'Chưa thể khôi phục phiên đăng nhập. Vui lòng kiểm tra kết nối rồi thử lại.'}</p>
      <button type="button" className="host-button" onClick={() => { setAuthCheck('checking'); setAuthRetry((n) => n + 1); }}>Thử lại</button>
      <button type="button" className="host-button" onClick={() => resetAuthentication()}>Đăng nhập lại</button></>}
  </main>;

  // 1. Màn hình Dashboard hiện có (Dùng chung tạm thời sau khi đăng nhập thành công)
  if (view === 'dashboard' && currentUser) {
    return (
      <AuthenticatedDashboard
        key={currentUser.accountId}
        user={currentUser}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
        onAuthenticationEnded={handleAuthenticationEnded}
        hostRoute={hostRoute}
        assetRoute={assetRoute}
        onNavigateAssets={navigateAssets}
        onCreatePendingChange={handleCreatePendingChange}
        onNavigateHost={navigateHost}
        onOverview={navigateOverview}
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
