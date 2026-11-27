import { ExpenseBreakdownPage } from './components/reports/ExpenseBreakdownPage';
import { expenseBreakdownPath, parseExpenseBreakdownRoute, type ExpenseBreakdownRoute } from './utils/expenseBreakdownNavigation';
import { ProfitLossPage } from './components/reports/ProfitLossPage';
import { parseProfitLossRoute, profitLossPath, type ProfitLossRoute } from './utils/profitLossNavigation';
import { FinancePage } from './components/reports/FinancePage';
import { financePath, parseFinanceRoute, type FinanceRoute } from './utils/financeNavigation';
import { CustomerLookupPage } from './components/customers/CustomerLookupPage';
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { SessionSplash } from './components/auth/SessionSplash';
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
import { resolveAuthDocumentTitle, resolveDashboardDocumentTitle } from './utils/documentTitle';
import {
  AutoDraftJobsForbidden,
  AutoDraftJobsPage,
} from './components/admin/AutoDraftJobsPage';
import { AUTO_DRAFT_JOBS_PATH, isAutoDraftJobsPath } from './types/autoDraftBilling';
import { parseHostAccountRoute } from './utils/hostAccountNavigation';
import { HOST_ACCOUNTS_PATH, hostAccountMessages, type HostAccountRoute } from './types/hostAccounts';
import { AssetsPage, AssetsForbidden } from './components/assets/AssetsPage';
import { assetMessages, type AssetRoute } from './types/assets';
import { invalidateSession, onSessionChange, rememberSession } from './services/sessionClient';
import { assetRouteKey, parseAssetRoute } from './utils/assetNavigation';
import { PropertiesPage } from './components/properties/PropertiesPage';
import { RoomsPage } from './components/properties/RoomsPage';
import { RoomServicesPage, RoomServicesForbidden } from './components/services/RoomServicesPage';
import { RoomPaymentPolicyPage } from './components/payments/RoomPaymentPolicyPage';
import { paymentMessages } from './types/roomPaymentPolicy';
import type { PropertiesRoute, RoomsRoute } from './types/properties';
import { OccupancyAnalysisPage } from './components/reports/OccupancyAnalysisPage';
import { occupancyAnalysisPath, parseOccupancyAnalysisRoute, type OccupancyAnalysisQuery } from './utils/occupancyAnalysisNavigation';
import { ExpiringLeaseReportPage } from './components/reports/ExpiringLeaseReportPage';
import { expiringLeasePath, parseExpiringLeaseRoute, type ExpiringLeaseQuery } from './utils/expiringLeaseNavigation';
import { OccupancyReportPage } from './components/reports/OccupancyReportPage';
import { occupancyPath, parseOccupancyRoute, type OccupancyQuery } from './utils/occupancyNavigation';
import { parsePropertiesRoute, parseRoomsRoute } from './utils/propertyNavigation';
import { CatalogForbidden, ServiceCatalogPage } from './components/services/ServiceCatalogPage';
import { catalogMessages, type CatalogRoute } from './types/serviceCatalog';
import { catalogUrl, parseCatalogRoute } from './utils/serviceCatalogNavigation';
import { ServicePolicyPage } from './components/services/ServicePolicyPage';
import type { ServicePolicyRoute } from './types/servicePolicy';
import { parseServicePolicyRoute, servicePolicyUrl } from './utils/servicePolicyNavigation';
import type { NavigationGuardRegistration } from './hooks/useServiceCatalog';
import { CustomerForbidden, CustomersPage } from './components/customers/CustomersPage';
import { parseCustomerRoute } from './utils/customerNavigation';
import { customerMessages, type CustomerRoute } from './types/customer';
import { DepositContractsPage } from './components/contracts/DepositContractsPage';
import type { DepositContractRoute } from './types/depositContract';
import { parseDepositContractRoute } from './utils/depositContractNavigation';
import { RentalContractsPage } from './components/contracts/RentalContractsPage';
import type { RentalContractRoute } from './types/rentalContract';
import { MeterReadingsPage, MeterForbidden } from './components/meter/MeterReadingsPage';
import type { MeterRoute } from './types/meterReading';
import { parseMeterRoute, meterUrl } from './utils/meterNavigation';
import { parseRentalContractRoute } from './utils/rentalContractNavigation';
import { PeriodUsagePage, UsageForbidden } from './components/usage/PeriodUsagePage';
import type { PeriodUsageRoute } from './types/periodUsage';
import { parsePeriodUsageRoute, periodUsageUrl } from './utils/periodUsageNavigation';
import { ProvisionalChargesPage } from './components/provisional/ProvisionalChargesPage';
import { InvoicePage } from './components/invoice/InvoicePage';
import { BillingSchedulePage } from './components/invoice/BillingSchedulePage';
import { invoicePath, isInvoicePath } from './services/invoiceApi';
import { billingSchedulePath, isBillingSchedulePath } from './utils/billingScheduleNavigation';
import type { ProvisionalRoute } from './types/provisionalCharge';
import { provisionalMessages } from './types/provisionalCharge';
import { parseProvisionalRoute, provisionalPath, provisionalUrl } from './utils/provisionalChargeNavigation';

import { FundingSourcesPage, FundingForbidden } from './components/funding/FundingSourcesPage';
import { fundingMessages, type FundingRoute } from './types/fundingSource';
import { parseFundingRoute, fundingUrl } from './utils/fundingNavigation';

import { RentalProfilePage } from './components/rentalProfile/RentalProfilePage';
import { isRentalProfilePath, rentalProfilePath, rentalProfileTitle, rentalProfileMessages } from './types/rentalProfile';
import { DocumentTemplatesPage } from './components/templates/DocumentTemplatesPage';
import { parseDocumentTemplateRoute, type DocumentTemplateRoute } from './utils/documentTemplateNavigation';

const SESSION_SPLASH_MIN_MS = 800;

function isGoogleEntry(): boolean {
  return window.location.pathname === '/auth/onboarding' || window.location.pathname === '/auth/callback'
    || new URLSearchParams(window.location.search).has('status');
}

const parseReportRoute = (path: string, search: string) =>
  parseExpenseBreakdownRoute(path, search) ?? parseProfitLossRoute(path, search) ?? parseFinanceRoute(path, search) ?? parseOccupancyRoute(path, search) ?? parseExpiringLeaseRoute(path, search) ?? parseOccupancyAnalysisRoute(path, search);

function isProtectedPath(pathname: string, search: string): boolean {
  return Boolean(
    isInvoicePath(pathname)
    || isBillingSchedulePath(pathname)
    || isAutoDraftJobsPath(pathname)
    || isRentalProfilePath(pathname)
    || parseFundingRoute(pathname, search)
    || parseProvisionalRoute(pathname, search)
    || parsePeriodUsageRoute(pathname, search)
    || parseMeterRoute(pathname, search)
    || parseHostAccountRoute(pathname)
    || parseAssetRoute(pathname, search)
    || parsePropertiesRoute(pathname, search)
    || parseRoomsRoute(pathname, search)
    || parseReportRoute(pathname, search)
    || parseCatalogRoute(pathname, search)
    || parseServicePolicyRoute(pathname, search)
    || parseCustomerRoute(pathname, search)
    || parseDepositContractRoute(pathname, search)
    || parseRentalContractRoute(pathname, search)
    || parseDocumentTemplateRoute(pathname, search)
  );
}

function AuthenticatedDashboard({
  user,
  onLogout,
  onSessionExpired,
  onAuthenticationEnded,
  hostRoute,
  onNavigateHost,
  assetRoute,
  onNavigateAssets,
  propertiesRoute,
  onNavigateProperties,
  occupancyRoute,
  roomsRoute,
  onNavigateRooms,
  contractRoute,
  onNavigateContracts,
  rentalContractRoute,
  onNavigateRentalContracts,
  templateRoute,
  onNavigateTemplates,
  onCreatePendingChange,
  onOverview,
  catalogRoute,
  onNavigateCatalog,
  policyRoute,
  onNavigatePolicy,
  meterRoute,
  onNavigateMeter,
  periodUsageRoute,
  onNavigatePeriodUsage,
  fundingRoute,
  onNavigateFunding,
  rentalProfileActive,
  onNavigateRentalProfile,
  provisionalRoute,
  onNavigateProvisional,
  customerRoute,
  onNavigateCustomers,
  onNavigatePath,
  registerGuard,
}: {
  user: AuthenticatedUserResponse;
  onLogout: () => void;
  onSessionExpired: () => void;
  onAuthenticationEnded: (notice: AuthNotice) => void;
  hostRoute: HostAccountRoute | null;
  onNavigateHost: (id: string | null) => void;
  onOverview: () => void;
  assetRoute: AssetRoute | null;
  onNavigateAssets: (url: string, replace?: boolean) => void;
  propertiesRoute: PropertiesRoute | null;
  onNavigateProperties: (url: string) => void;
  occupancyRoute: OccupancyQuery | ExpiringLeaseQuery | OccupancyAnalysisQuery | FinanceRoute | ProfitLossRoute | ExpenseBreakdownRoute | null;
  roomsRoute: RoomsRoute | null;
  onNavigateRooms: (url: string) => void;
  contractRoute: DepositContractRoute | null;
  onNavigateContracts: (url: string) => void;
  rentalContractRoute: RentalContractRoute | null;
  onNavigateRentalContracts: (url: string) => void;
  templateRoute: DocumentTemplateRoute | null;
  onNavigateTemplates: (url: string) => void;
  onCreatePendingChange: (pending: boolean) => void;
  catalogRoute: CatalogRoute | null;
  onNavigateCatalog: (url: string, replace?: boolean) => void;
  policyRoute: ServicePolicyRoute | null;
  onNavigatePolicy: (url: string, replace?: boolean) => void;
  meterRoute: MeterRoute | null;
  onNavigateMeter: (url: string) => void;
  periodUsageRoute: PeriodUsageRoute | null;
  onNavigatePeriodUsage: (url: string) => void;
  fundingRoute: FundingRoute | null;
  onNavigateFunding: (url: string, replace?: boolean) => void;
  rentalProfileActive: boolean;
  onNavigateRentalProfile: () => void;
  provisionalRoute: ProvisionalRoute | null;
  onNavigateProvisional: (url: string) => void;
  customerRoute: CustomerRoute | null;
  onNavigateCustomers: (url: string, replace?: boolean) => void;
  onNavigatePath: (url: string) => void;
  registerGuard: NavigationGuardRegistration;
}) {
  const profileController = useProfile(onSessionExpired);

  const occupancyKind = occupancyRoute && 'kind' in occupancyRoute ? occupancyRoute.kind : null;
  const currentPathname = window.location.pathname;
  useEffect(() => {
    document.title = resolveDashboardDocumentTitle({
      pathname: currentPathname,
      role: user.role,
      templateActive: templateRoute !== null,
      fundingActive: fundingRoute !== null,
      rentalProfileActive,
      provisionalActive: provisionalRoute !== null,
      periodUsageActive: periodUsageRoute !== null,
      meterActive: meterRoute !== null,
      customerActive: customerRoute !== null,
      policyActive: policyRoute !== null,
      catalogActive: catalogRoute !== null,
      contractActive: contractRoute !== null,
      rentalContractActive: rentalContractRoute !== null,
      propertiesActive: propertiesRoute !== null,
      occupancyKind,
      occupancyActive: occupancyRoute !== null,
      roomsActive: roomsRoute !== null,
      assetActive: assetRoute !== null,
      hostActive: hostRoute !== null,
    });
  }, [
    currentPathname, user.role, templateRoute, fundingRoute, rentalProfileActive,
    provisionalRoute, periodUsageRoute, meterRoute, customerRoute, policyRoute,
    catalogRoute, contractRoute, rentalContractRoute, propertiesRoute,
    occupancyKind, occupancyRoute, roomsRoute, assetRoute, hostRoute,
  ]);
  const [accountModal, setAccountModal] = useState<'profile' | 'password' | null>(null);
  const [focusChangePassword, setFocusChangePassword] = useState(false);
  const [adminDenied, setAdminDenied] = useState(false);
  const [assetsDenied, setAssetsDenied] = useState(false);
  const [catalogDenied, setCatalogDenied] = useState(false);
  const [fundingDenied, setFundingDenied] = useState(false);
  const denyFunding = useCallback(() => { setAccountModal(null); setFundingDenied(true); }, []);
  const [customersDenied, setCustomersDenied] = useState(false);
  const denyCustomers = useCallback(() => { setAccountModal(null); setCustomersDenied(true); }, []);
  const denyCatalog = useCallback(() => { setAccountModal(null); setCatalogDenied(true); }, []);
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

  const servicesActive = catalogRoute !== null || policyRoute !== null;

  return (
    <>
      <DashboardShell
        user={activeUserProfile}
        onLogout={onLogout}
        onOpenProfile={() => {
          setFocusChangePassword(false);
          setAccountModal('profile');
          void profileController.fetchProfile();
        }}
        hostAccountsActive={hostRoute !== null}
        showHostAccounts={user.role === 'ADMIN' && !adminDenied}
        autoDraftJobsActive={isAutoDraftJobsPath(window.location.pathname)}
        showAutoDraftJobs={user.role === 'ADMIN' && !adminDenied}
        onNavigateAutoDraftJobs={() => {
          window.history.pushState(null, '', AUTO_DRAFT_JOBS_PATH);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        assetsActive={assetRoute !== null}
        showAssets={user.role === 'HOST' && !assetsDenied}
        onNavigateAssets={() => onNavigateAssets('/assets')}
        showProperties={user.role === 'HOST'}
        propertiesActive={propertiesRoute !== null}
        onNavigateProperties={() => onNavigateProperties('/properties')}
        showRooms={user.role === 'HOST'}
        financeActive={occupancyRoute !== null && 'kind' in occupancyRoute && (occupancyRoute.kind === 'finance' || occupancyRoute.kind === 'cash-ledger')}
        expenseBreakdownActive={occupancyRoute !== null && 'kind' in occupancyRoute && occupancyRoute.kind === 'expense-breakdown'}
        onNavigateExpenseBreakdown={user.role === 'HOST' ? () => onNavigateRooms(expenseBreakdownPath) : undefined}
        profitLossActive={occupancyRoute !== null && 'kind' in occupancyRoute && occupancyRoute.kind === 'profit-loss'}
        onNavigateProfitLoss={user.role === 'HOST' ? () => onNavigateRooms(profitLossPath) : undefined}
        onNavigateFinance={user.role === 'HOST' ? () => onNavigateRooms(financePath) : undefined}
        occupancyActive={occupancyRoute !== null && !('kind' in occupancyRoute)}
        expiringLeasesActive={occupancyRoute !== null && 'kind' in occupancyRoute && occupancyRoute.kind === 'expiring-leases'}
        occupancyAnalysisActive={occupancyRoute !== null && 'kind' in occupancyRoute && occupancyRoute.kind === 'occupancy-analysis'}
        onNavigateOccupancyAnalysis={user.role === 'HOST' ? () => onNavigateRooms(occupancyAnalysisPath) : undefined}
        onNavigateExpiringLeases={user.role === 'HOST' ? () => onNavigateRooms(expiringLeasePath) : undefined}
        onNavigateOccupancy={user.role === 'HOST' ? () => onNavigateRooms(occupancyPath) : undefined}
        roomsActive={roomsRoute !== null}
        onNavigateRooms={() => onNavigateRooms('/rooms')}
        showContracts={user.role === 'HOST'}
        contractsActive={contractRoute !== null}
        onNavigateContracts={() => onNavigateContracts('/deposit-contracts')}
        rentalContractsActive={rentalContractRoute !== null}
        onNavigateRentalContracts={() => onNavigateRentalContracts('/rental-contracts')}
        showDocumentTemplates={user.role === 'HOST'}
        documentTemplatesActive={templateRoute !== null}
        onNavigateDocumentTemplates={() => onNavigateTemplates('/document-templates')}
        showCustomers={user.role === 'HOST' && !customersDenied}
        showMeterReadings={user.role === 'HOST'}
        meterReadingsActive={meterRoute !== null}
        onNavigateMeterReadings={() => onNavigateMeter('/meter-readings')}
        showPeriodUsages={user.role === 'HOST'}
        periodUsagesActive={periodUsageRoute !== null}
        onNavigatePeriodUsages={() => onNavigatePeriodUsage('/period-usages')}
        showFundingSources={user.role === 'HOST' && !fundingDenied}
        fundingSourcesActive={fundingRoute !== null}
        onNavigateFundingSources={() => onNavigateFunding('/funding-sources')}
        showRentalProfile={user.role === 'CUSTOMER'}
        rentalProfileActive={rentalProfileActive}
        onNavigateRentalProfile={onNavigateRentalProfile}
        invoiceLink={user.role === 'HOST' || user.role === 'CUSTOMER' ? {
          path: invoicePath(user.role === 'HOST' ? 'host' : 'customer'),
          label: user.role === 'HOST' ? 'Quản lý hóa đơn' : 'Hóa đơn của tôi',
          active: isInvoicePath(window.location.pathname),
          onNavigate: () => onNavigatePath(invoicePath(user.role === 'HOST' ? 'host' : 'customer')),
        } : undefined}
        billingScheduleLink={user.role === 'HOST' ? {
          path: billingSchedulePath,
          label: 'Lịch lập hóa đơn',
          active: isBillingSchedulePath(window.location.pathname),
          onNavigate: () => onNavigatePath(billingSchedulePath),
        } : undefined}
        onNavigatePath={onNavigatePath}
        showProvisionalCharges={user.role === 'HOST' || user.role === 'CUSTOMER'}
        provisionalChargesActive={provisionalRoute !== null}
        provisionalChargesPath={provisionalPath(user.role === 'CUSTOMER' ? 'CUSTOMER' : 'HOST')}
        onNavigateProvisionalCharges={() => onNavigateProvisional(provisionalPath(user.role === 'CUSTOMER' ? 'CUSTOMER' : 'HOST'))}
        customersActive={customerRoute !== null}
        onNavigateCustomers={() => onNavigateCustomers('/customers')}
        showServices={user.role === 'HOST' && !catalogDenied}
        servicesActive={servicesActive}
        onNavigateServices={() => onNavigateCatalog('/services')}
        onNavigateOverview={onOverview}
        onNavigateHostAccounts={() => onNavigateHost(null)}
      >
        {isAutoDraftJobsPath(window.location.pathname) ? (
          user.role === 'ADMIN' ? <AutoDraftJobsPage /> : <AutoDraftJobsForbidden onOverview={onOverview} />
        ) : isBillingSchedulePath(window.location.pathname) ? (
          user.role === 'HOST' ? (
            <BillingSchedulePage
              accountId={user.accountId}
              onOpenNotifications={() => window.dispatchEvent(new CustomEvent('rentops:open-host-notifications'))}
            />
          ) : (
            <section className="pc-page"><p role="alert">Bạn không có quyền xem lịch lập hóa đơn.</p></section>
          )
        ) : isInvoicePath(window.location.pathname) ? (
          <InvoicePage key={window.location.href} registerGuard={registerGuard} accountRole={user.role} accountId={user.accountId} pathname={window.location.pathname} search={window.location.search} />
        ) : templateRoute ? (
          user.role !== 'HOST' ? (
            <section className="templates-page">
              <h1>Mẫu tài liệu</h1>
              <p role="alert">Bạn không có quyền quản lý mẫu tài liệu.</p>
              <button type="button" className="contract-action-btn" onClick={onOverview}>Về tổng quan</button>
            </section>
          ) : (
            <DocumentTemplatesPage route={templateRoute} onNavigate={onNavigateTemplates} onSessionExpired={onSessionExpired} />
          )
        ) : fundingRoute ? (
          fundingDenied ? <FundingForbidden onBack={onOverview} /> : <FundingSourcesPage user={user} route={fundingRoute} onNavigate={onNavigateFunding} onBack={onOverview}
            onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: fundingMessages.session })} onForbidden={denyFunding} registerGuard={registerGuard} />
        ) : rentalProfileActive ? (
          <RentalProfilePage allowed={user.role === 'CUSTOMER'} onSessionExpired={onSessionExpired} />
        ) : provisionalRoute ? (
          <ProvisionalChargesPage user={user} route={provisionalRoute} onNavigate={onNavigateProvisional} onBack={onOverview}
            onSessionExpired={(message) => onAuthenticationEnded({ kind: 'error', message })} />
        ) : periodUsageRoute ? (
          user.role !== 'HOST' ? <UsageForbidden onBack={onOverview} /> : (
            <PeriodUsagePage
              route={periodUsageRoute}
              onNavigate={onNavigatePeriodUsage}
              registerGuard={registerGuard}
              onSessionExpired={(message) => onAuthenticationEnded({ kind: 'error', message: message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' })}
            />
          )
        ) : meterRoute ? (
          user.role !== 'HOST' ? <MeterForbidden onBack={onOverview} /> : (
            <MeterReadingsPage route={meterRoute} onNavigate={onNavigateMeter} registerGuard={registerGuard}
              onSessionExpired={(message) => onAuthenticationEnded({ kind: 'error', message: message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' })} />
          )
        ) : customerRoute ? (
          user.role !== 'HOST' || customersDenied ? (
            <CustomerForbidden onOverview={onOverview} />
          ) : customerRoute.lookup ? (
            <CustomerLookupPage route={customerRoute.lookup} onNavigate={onNavigateCustomers}
              onSessionExpired={(message) => onAuthenticationEnded({ kind: 'error', message: message || customerMessages.sessionInvalid })}
              onForbidden={denyCustomers} />
          ) : (
            <CustomersPage
              route={customerRoute}
              onNavigate={onNavigateCustomers}
              registerGuard={registerGuard}
              onSessionExpired={(message) => onAuthenticationEnded({ kind: 'error', message: message || customerMessages.sessionInvalid })}
              onForbidden={denyCustomers}
            />
          )
        ) : policyRoute ? (
          user.role !== 'HOST' || catalogDenied ? (
            <CatalogForbidden onOverview={onOverview} />
          ) : (
            <ServicePolicyPage
              route={policyRoute}
              onNavigate={onNavigatePolicy}
              registerGuard={registerGuard}
              onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: catalogMessages.sessionInvalid })}
              onForbidden={denyCatalog}
            />
          )
        ) : catalogRoute ? (
          user.role !== 'HOST' || catalogDenied ? (
            <CatalogForbidden onOverview={onOverview} />
          ) : (
            <ServiceCatalogPage
              route={catalogRoute}
              onNavigate={onNavigateCatalog}
              registerGuard={registerGuard}
              onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: catalogMessages.sessionInvalid })}
              onForbidden={denyCatalog}
            />
          )
        ) : occupancyRoute ? (
          user.role === 'HOST' ? (
            'kind' in occupancyRoute && occupancyRoute.kind === 'expense-breakdown' ? (
              <ExpenseBreakdownPage route={occupancyRoute} onNavigate={onNavigateRooms} onSessionExpired={onSessionExpired} />
            ) : 'kind' in occupancyRoute && occupancyRoute.kind === 'profit-loss' ? (
              <ProfitLossPage route={occupancyRoute} onNavigate={onNavigateRooms} onSessionExpired={onSessionExpired} />
            ) : 'kind' in occupancyRoute && (occupancyRoute.kind === 'finance' || occupancyRoute.kind === 'cash-ledger') ? (
              <FinancePage route={occupancyRoute} onNavigate={onNavigateRooms} onSessionExpired={onSessionExpired} />
            ) : 'kind' in occupancyRoute && occupancyRoute.kind === 'occupancy-analysis' ? (
              <OccupancyAnalysisPage query={occupancyRoute} onNavigate={onNavigateRooms} onSessionExpired={onSessionExpired} />
            ) : 'kind' in occupancyRoute && occupancyRoute.kind === 'expiring-leases' ? (
              <ExpiringLeaseReportPage query={occupancyRoute} onNavigate={onNavigateRooms}
                onContract={onNavigateRentalContracts} onSessionExpired={onSessionExpired} />
            ) :
            !('kind' in occupancyRoute) && <OccupancyReportPage
              query={occupancyRoute}
              onNavigate={onNavigateRooms}
              onRoom={onNavigateRooms}
              onContract={onNavigateRentalContracts}
              onProperties={onNavigateProperties}
              onSessionExpired={onSessionExpired}
            />
          ) : <CatalogForbidden onOverview={onOverview} />
        ) : rentalContractRoute?.action && user.role !== 'HOST' ? (
          <CatalogForbidden onOverview={onOverview} />
        ) : rentalContractRoute ? (
          <RentalContractsPage
            route={rentalContractRoute}
            onNavigate={onNavigateRentalContracts}
            onSessionExpired={() =>
              onAuthenticationEnded({
                kind: 'error',
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
              })
            }
          />
        ) : contractRoute ? (
          <DepositContractsPage
            route={contractRoute}
            onNavigate={onNavigateContracts}
            onSessionExpired={() =>
              onAuthenticationEnded({
                kind: 'error',
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
              })
            }
          />
        ) : propertiesRoute ? (
          <PropertiesPage
            route={propertiesRoute}
            onNavigate={onNavigateProperties}
            onNavigateRooms={(bId) => onNavigateRooms(`/rooms?view=matrix&buildingId=${bId}`)}
            onSessionExpired={() =>
              onAuthenticationEnded({
                kind: 'error',
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
              })
            }
          />
        ) : roomsRoute?.paymentPolicy ? (
          user.role !== 'HOST' ? <RoomServicesForbidden onBack={onOverview} /> : (
            <RoomPaymentPolicyPage
              key={`${user.accountId}:${roomsRoute.roomId}`}
              route={{ roomId: roomsRoute.roomId || '', returnTo: roomsRoute.returnTo || '/rooms' }}
              allowed={user.role === 'HOST'}
              registerGuard={registerGuard}
              onNavigate={onNavigateRooms}
              onManageFunds={() => onNavigateFunding('/funding-sources')}
              onSessionExpired={() =>
                onAuthenticationEnded({
                  kind: 'error',
                  message: paymentMessages.session,
                })
              }
              onForbidden={(msg) =>
                onAuthenticationEnded({
                  kind: 'error',
                  message: msg || paymentMessages.forbidden,
                })
              }
              onMissing={() => {
                onNavigateRooms('/rooms');
              }}
            />
          )
        ) : roomsRoute?.services ? (
          user.role !== 'HOST' ? <RoomServicesForbidden onBack={onOverview} /> :
          <RoomServicesPage
            key={`${user.accountId}:${roomsRoute.roomId}`}
            route={{ roomId: roomsRoute.roomId || '', returnTo: roomsRoute.returnTo || '/rooms' }}
            onNavigate={onNavigateRooms}
            registerGuard={registerGuard}
            onSessionExpired={onSessionExpired}
          />
        ) : roomsRoute ? (
          <RoomsPage
            route={roomsRoute}
            onNavigate={onNavigateRooms}
            onSessionExpired={() =>
              onAuthenticationEnded({
                kind: 'error',
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại',
              })
            }
          />
        ) : assetRoute ? (
          user.role !== 'HOST' || assetsDenied ? (
            <AssetsForbidden onOverview={onOverview} />
          ) : (
            <AssetsPage
              route={assetRoute}
              onNavigate={onNavigateAssets}
              onCreatePendingChange={onCreatePendingChange}
              onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: assetMessages.sessionInvalid })}
              onForbidden={denyAssets}
            />
          )
        ) : hostRoute && (user.role !== 'ADMIN' || adminDenied ? (
          <HostAccountsForbidden onOverview={onOverview} />
        ) : (
          <HostAccountsPage
            accountId={hostRoute.accountId}
            onNavigate={onNavigateHost}
            onSessionExpired={() => onAuthenticationEnded({ kind: 'error', message: hostAccountMessages.sessionInvalid })}
            onForbidden={denyAdmin}
          />
        ))}
      </DashboardShell>
      <ProfileModal
        isOpen={accountModal === 'profile'}
        controller={profileController}
        onClose={() => setAccountModal(null)}
        focusChangePassword={focusChangePassword}
        onOpenChangePassword={() => setAccountModal('password')}
      />
      {accountModal === 'password' && (
        <ChangePasswordModal
          onAuthenticationEnded={onAuthenticationEnded}
          onClose={() => {
            setFocusChangePassword(true);
            setAccountModal('profile');
          }}
        />
      )}
    </>
  );
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
  const [propertiesRoute, setPropertiesRoute] = useState<PropertiesRoute | null>(() => parsePropertiesRoute(window.location.pathname, window.location.search));
  const [occupancyRoute, setOccupancyRoute] = useState(() => parseReportRoute(window.location.pathname, window.location.search));
  const [roomsRoute, setRoomsRoute] = useState<RoomsRoute | null>(() => parseRoomsRoute(window.location.pathname, window.location.search));
  const [catalogRoute, setCatalogRoute] = useState<CatalogRoute | null>(() => parseCatalogRoute(window.location.pathname, window.location.search));
  const [policyRoute, setPolicyRoute] = useState<ServicePolicyRoute | null>(() => parseServicePolicyRoute(window.location.pathname, window.location.search));
  const [meterRoute, setMeterRoute] = useState<MeterRoute | null>(() => parseMeterRoute(window.location.pathname, window.location.search));
  const [periodUsageRoute, setPeriodUsageRoute] = useState<PeriodUsageRoute | null>(() => parsePeriodUsageRoute(window.location.pathname, window.location.search));
  const [fundingRoute, setFundingRoute] = useState<FundingRoute | null>(() => parseFundingRoute(window.location.pathname, window.location.search));
  const [rentalProfileActive, setRentalProfileActive] = useState(() => isRentalProfilePath(window.location.pathname));
  const [provisionalRoute, setProvisionalRoute] = useState<ProvisionalRoute | null>(() => parseProvisionalRoute(window.location.pathname, window.location.search));
  const [customerRoute, setCustomerRoute] = useState<CustomerRoute | null>(() => parseCustomerRoute(window.location.pathname, window.location.search));
  const [contractRoute, setContractRoute] = useState<DepositContractRoute | null>(() => parseDepositContractRoute(window.location.pathname, window.location.search));
  const [rentalContractRoute, setRentalContractRoute] = useState<RentalContractRoute | null>(() => parseRentalContractRoute(window.location.pathname, window.location.search));
  const [templateRoute, setTemplateRoute] = useState<DocumentTemplateRoute | null>(() => parseDocumentTemplateRoute(window.location.pathname, window.location.search));
  const navigationGuard = useRef<(() => boolean) | null>(null);
  const registerGuard = useCallback<NavigationGuardRegistration>((guard) => { navigationGuard.current = guard; }, []);
  const permitNavigation = useCallback(() => navigationGuard.current?.() !== false, []);
  const [, setLocationVersion] = useState(0);
  const navigateSpaPath = useCallback((url: string) => {
    if (!permitNavigation()) return;
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState(null, '', url);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [permitNavigation]);

  const lastUrl = useRef(window.location.pathname + window.location.search);
  useLayoutEffect(() => {
    lastUrl.current = window.location.pathname + window.location.search;
  }, [hostRoute, assetRoute, propertiesRoute, roomsRoute, occupancyRoute, catalogRoute, policyRoute, meterRoute, periodUsageRoute, provisionalRoute, fundingRoute, rentalProfileActive, customerRoute, contractRoute, rentalContractRoute, templateRoute]);
  const googleEntry = useRef(isGoogleEntry());
  const [authCheck, setAuthCheck] = useState<'checking' | 'ready' | 'error'>(() => isGoogleEntry() ? 'ready' : 'checking');
  const [authRetry, setAuthRetry] = useState(0);

  useEffect(() => {
    if (view === 'dashboard' && currentUser) return;
    document.title = resolveAuthDocumentTitle(recovery.path, view, authCheck);
  }, [recovery.path, view, authCheck, currentUser]);

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
    if (authCheck !== 'checking' || recovery.path || googleEntry.current) return;
    const controller = new AbortController();
    let cancelled = false;
    let splashTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = performance.now();
    const generation = authGeneration.current;
    const finishAfterSplash = (finish: () => void) => {
      if (cancelled || generation !== authGeneration.current) return;
      const complete = () => {
        if (!cancelled && generation === authGeneration.current) finish();
      };
      const remaining = Math.ceil(SESSION_SPLASH_MIN_MS - (performance.now() - startedAt));
      if (remaining > 0) splashTimer = setTimeout(complete, remaining);
      else complete();
    };
    getCurrentUser({ signal: controller.signal })
      .then((user) => {
        finishAfterSplash(() => handleAuthSuccess(user));
      })
      .catch((error: unknown) => {
        if (cancelled || generation !== authGeneration.current) return;
        const assets = parseAssetRoute(window.location.pathname, window.location.search);
        const services = parseCatalogRoute(window.location.pathname, window.location.search);
        const policy = parseServicePolicyRoute(window.location.pathname, window.location.search);
        const customers = parseCustomerRoute(window.location.pathname, window.location.search);
        const rentalProfile = isRentalProfilePath(window.location.pathname);
        const provisional = parseProvisionalRoute(window.location.pathname, window.location.search);
        const funding = parseFundingRoute(window.location.pathname, window.location.search);
        const rooms = parseRoomsRoute(window.location.pathname, window.location.search);
        if (!(error instanceof AuthApiError) || error.status !== 401) {
          setAuthCheck('error'); return;
        }
        finishAfterSplash(() => {
          setAuthCheck('ready');
          if (isProtectedPath(window.location.pathname, window.location.search)) {
            window.history.replaceState(null, '', '/');
            setHostRoute(null);
            setAssetRoute(null);
            setPropertiesRoute(null);
            setRoomsRoute(null);
            setOccupancyRoute(null);
            setCatalogRoute(null);
            setPolicyRoute(null);
            setMeterRoute(null);
            setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null);
            setCustomerRoute(null);
            setContractRoute(null);
            setRentalContractRoute(null);
            setTemplateRoute(null);
            setAuthNotice({
              kind: 'error',
              message: rentalProfile ? rentalProfileMessages.session : rooms?.paymentPolicy ? paymentMessages.session : funding ? fundingMessages.session : provisional ? provisionalMessages.session : customers ? customerMessages.sessionInvalid : services || policy ? catalogMessages.sessionInvalid : assets ? assetMessages.sessionInvalid : hostAccountMessages.sessionInvalid,
            });
          }
        });
      });
    return () => { cancelled = true; controller.abort(); clearTimeout(splashTimer); };
  }, [handleAuthSuccess, authRetry, authCheck, recovery.path]);

  useEffect(() => {
    initialRecovery?.release();
    const onPopState = () => {
      if (pendingCreateUrl.current) { window.history.pushState(null, '', pendingCreateUrl.current); return; }
      if (!permitNavigation()) { window.history.pushState(null, '', lastUrl.current); return; }
      const next = captureRecoveryEntry();
      const wasRecovery = recoveryRoute.current !== null;
      recoveryRoute.current = next.path;
      setHostRoute(parseHostAccountRoute(window.location.pathname));
      setAssetRoute(parseAssetRoute(window.location.pathname, window.location.search));
      setPropertiesRoute(parsePropertiesRoute(window.location.pathname, window.location.search));
      setRoomsRoute(parseRoomsRoute(window.location.pathname, window.location.search));
      setOccupancyRoute(parseReportRoute(window.location.pathname, window.location.search));
      setCatalogRoute(parseCatalogRoute(window.location.pathname, window.location.search));
      setPolicyRoute(parseServicePolicyRoute(window.location.pathname, window.location.search));
      setMeterRoute(parseMeterRoute(window.location.pathname, window.location.search));
      setPeriodUsageRoute(parsePeriodUsageRoute(window.location.pathname, window.location.search));
      setRentalProfileActive(isRentalProfilePath(window.location.pathname));
      setProvisionalRoute(parseProvisionalRoute(window.location.pathname, window.location.search));
      setFundingRoute(parseFundingRoute(window.location.pathname, window.location.search));
      setCustomerRoute(parseCustomerRoute(window.location.pathname, window.location.search));
      setContractRoute(parseDepositContractRoute(window.location.pathname, window.location.search));
      setRentalContractRoute(parseRentalContractRoute(window.location.pathname, window.location.search));
      setTemplateRoute(parseDocumentTemplateRoute(window.location.pathname, window.location.search));
      setLocationVersion((version) => version + 1);

      // Private navigation preserves the authenticated user and pending session check.
      if (!next.path && !wasRecovery) return;
      authGeneration.current++;
      setRecovery(next); setRecoveryVisit((n) => n + 1);
      setCurrentUser(null); setView('login'); setAuthNotice(null);
      if (!next.path && isProtectedPath(window.location.pathname, window.location.search)) {
        setAuthCheck('checking'); setAuthRetry((n) => n + 1);
      } else setAuthCheck('ready');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialRecovery, permitNavigation]);

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
    window.history.replaceState(null, '', '/');
    setHostRoute(null);
    setAssetRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null);
    setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null);
    setCustomerRoute(null);
    navigationGuard.current = null;
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
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
    resetAuthentication({
      kind: 'error',
      message:
        isRentalProfilePath(window.location.pathname) ? rentalProfileMessages.session
          : parseFundingRoute(window.location.pathname, window.location.search) ? fundingMessages.session : parseCustomerRoute(window.location.pathname, window.location.search)
          ? customerMessages.sessionInvalid
          : parseCatalogRoute(window.location.pathname, window.location.search) ||
            parseServicePolicyRoute(window.location.pathname, window.location.search)
            ? catalogMessages.sessionInvalid
            : parseAssetRoute(window.location.pathname, window.location.search)
              ? assetMessages.sessionInvalid
              : profileMessages.sessionInvalid,
    });
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
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null); setCatalogRoute(null); setPolicyRoute(null); setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null); setAuthCheck('ready');
  };

  const finishRecovery = (notice: AuthNotice) => {
    recoveryRoute.current = null;
    window.history.replaceState(null, '', '/');
    setRecovery({ path: null, token: null }); setPrefilledIdentifier('');
    resetAuthentication(notice);
  };

  const navigateHost = useCallback((id: string | null) => {
    if (!permitNavigation()) return;
    const path = HOST_ACCOUNTS_PATH + (id === null ? '' : '/' + encodeURIComponent(id));
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setHostRoute({ accountId: id });
    setAssetRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
  }, [permitNavigation]);

  const navigateOverview = useCallback(() => {
    if (!permitNavigation()) return;
    if (window.location.pathname !== '/') window.history.pushState(null, '', '/');
    setHostRoute(null);
    setAssetRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
  }, [permitNavigation]);

  const navigateAssets = useCallback((url: string, replace = false) => {
    if (!permitNavigation()) return;
    const target = new URL(url, window.location.origin);
    const next = parseAssetRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin) return;
    const canonical = assetRouteKey(next);
    if (window.location.pathname + window.location.search !== canonical) {
      if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
    }
    setHostRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
    setAssetRoute(next);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null);
  }, [permitNavigation]);

  const navigateProperties = useCallback((url: string) => {
    if (!permitNavigation()) return;
    window.history.pushState(null, '', url);
    setHostRoute(null);
    setAssetRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
    setPropertiesRoute(parsePropertiesRoute(window.location.pathname, window.location.search));
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null);
  }, [permitNavigation]);

  const navigateRoomWorkspace = useCallback((url: string) => {
    if (!permitNavigation()) return;
    window.history.pushState(null, '', url);
    setHostRoute(null);
    setAssetRoute(null);
    setPropertiesRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
    setRoomsRoute(parseRoomsRoute(window.location.pathname, window.location.search));
    setOccupancyRoute(parseReportRoute(window.location.pathname, window.location.search));
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null);
  }, [permitNavigation]);

  const navigateCatalog = useCallback((url: string, replace = false) => {
    const target = new URL(url, window.location.origin);
    const policy = parseServicePolicyRoute(target.pathname, target.search);
    if (policy) {
      if (!permitNavigation()) return;
      const canonical = servicePolicyUrl(policy);
      if (window.location.pathname + window.location.search !== canonical) {
        if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
      }
      setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null); setCatalogRoute(null); setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
      setPolicyRoute(policy);
      return;
    }
    const next = parseCatalogRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || !permitNavigation()) return;
    const canonical = catalogUrl(next, next.action, next.serviceId);
    if (window.location.pathname + window.location.search !== canonical) {
      if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
    }
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null); setPolicyRoute(null); setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setCatalogRoute(next);
  }, [permitNavigation]);

  const navigatePolicy = useCallback((url: string, replace = false) => {
    const target = new URL(url, window.location.origin);
    const catalog = parseCatalogRoute(target.pathname, target.search);
    if (catalog) {
      if (!permitNavigation()) return;
      const canonical = catalogUrl(catalog, catalog.action, catalog.serviceId);
      if (window.location.pathname + window.location.search !== canonical) {
        if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
      }
      setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null); setPolicyRoute(null); setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
      setCatalogRoute(catalog);
      return;
    }
    const next = parseServicePolicyRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || !permitNavigation()) return;
    const canonical = servicePolicyUrl(next);
    if (window.location.pathname + window.location.search !== canonical) {
      if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
    }
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null); setCatalogRoute(null); setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setPolicyRoute(next);
  }, [permitNavigation]);

  const navigateCustomers = useCallback((url: string, replace = false) => {
    if (!permitNavigation()) return;
    const target = new URL(url, window.location.origin);
    const next = parseCustomerRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin) return;
    if (window.location.pathname + window.location.search !== url) {
      if (replace) window.history.replaceState(null, '', url); else window.history.pushState(null, '', url);
    }
    setHostRoute(null);
    setAssetRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(null);
    setMeterRoute(null);
    setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null);
    setCustomerRoute(next);
  }, [permitNavigation]);

  const navigateMeter = useCallback((url: string) => {
    const target = new URL(url, window.location.origin);
    const next = parseMeterRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || !permitNavigation()) return;
    const canonical = next.invalid ? url : meterUrl(next);
    if (window.location.pathname + window.location.search !== canonical) window.history.pushState(null, '', canonical);
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null);
    setCatalogRoute(null); setPolicyRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setMeterRoute(next);
  }, [permitNavigation]);

  const navigatePeriodUsage = useCallback((url: string) => {
    const target = new URL(url, window.location.origin);
    const next = parsePeriodUsageRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || !permitNavigation()) return;
    const canonical = next.invalid ? url : periodUsageUrl(next);
    if (window.location.pathname + window.location.search !== canonical) window.history.pushState(null, '', canonical);
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null);
    setCatalogRoute(null); setPolicyRoute(null); setMeterRoute(null); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setPeriodUsageRoute(next);
  }, [permitNavigation]);

  const navigateFunding = useCallback((url: string, replace = false) => {
    const target = new URL(url, window.location.origin);
    const next = parseFundingRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || !permitNavigation()) return;
    const canonical = next.invalid ? target.pathname + target.search : fundingUrl(next, next.action, next.sourceId);
    if (window.location.pathname + window.location.search !== canonical) {
      if (replace) window.history.replaceState(null, '', canonical); else window.history.pushState(null, '', canonical);
    }
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null); setCatalogRoute(null); setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setFundingRoute(next);
  }, [permitNavigation]);

  const navigateRentalProfile = useCallback(() => {
    if (!permitNavigation()) return;
    if (window.location.pathname + window.location.search !== rentalProfilePath) {
      window.history.pushState(null, '', rentalProfilePath);
    }
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null);
    setCatalogRoute(null); setPolicyRoute(null); setMeterRoute(null); setPeriodUsageRoute(null);
    setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setProvisionalRoute(null); setFundingRoute(null); setRentalProfileActive(true);
  }, [permitNavigation]);

  const navigateProvisional = useCallback((url: string) => {
    const target = new URL(url, window.location.origin);
    const next = parseProvisionalRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || !permitNavigation()) return;
    const canonical = next.invalid ? target.pathname + target.search : provisionalUrl(next);
    if (window.location.pathname + window.location.search !== canonical) window.history.pushState(null, '', canonical);
    setHostRoute(null); setAssetRoute(null); setPropertiesRoute(null); setRoomsRoute(null); setOccupancyRoute(null);
    setCatalogRoute(null); setPolicyRoute(null); setMeterRoute(null); setPeriodUsageRoute(null);
    setCustomerRoute(null); setContractRoute(null); setRentalContractRoute(null); setTemplateRoute(null);
    setRentalProfileActive(false); setProvisionalRoute(next); setFundingRoute(null);
  }, [permitNavigation]);

  useEffect(() => {
    if (!catalogRoute || catalogRoute.invalid) return;
    const canonical = catalogUrl(catalogRoute, catalogRoute.action, catalogRoute.serviceId);
    if (window.location.pathname + window.location.search !== canonical) window.history.replaceState(null, '', canonical);
  }, [catalogRoute]);

  useEffect(() => {
    if (!policyRoute || policyRoute.invalid) return;
    const canonical = servicePolicyUrl(policyRoute);
    if (window.location.pathname + window.location.search !== canonical) window.history.replaceState(null, '', canonical);
  }, [policyRoute]);

  useEffect(() => {
    if (!periodUsageRoute || periodUsageRoute.invalid) return;
    const canonical = periodUsageUrl(periodUsageRoute);
    if (window.location.pathname + window.location.search !== canonical) window.history.replaceState(null, '', canonical);
  }, [periodUsageRoute]);

  const navigateTemplates = useCallback((url: string) => {
    const target = new URL(url, window.location.origin);
    const next = parseDocumentTemplateRoute(target.pathname, target.search);
    if (!next || target.origin !== window.location.origin || pendingCreateUrl.current || !permitNavigation()) return;
    const path = target.pathname + target.search;
    if (window.location.pathname + window.location.search !== path) window.history.pushState(null, '', path);
    setHostRoute(null);
    setAssetRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null);
    setPeriodUsageRoute(null);
    setProvisionalRoute(null);
    setRentalProfileActive(false);
    setFundingRoute(null);
    setCustomerRoute(null);
    setContractRoute(null);
    setRentalContractRoute(null);
    setTemplateRoute(next);
  }, [permitNavigation]);

  const navigateContracts = useCallback((url: string) => {
    if (!permitNavigation()) return;
    const target = new URL(url, window.location.origin);
    const deposit = parseDepositContractRoute(target.pathname, target.search);
    const rental = parseRentalContractRoute(target.pathname, target.search);
    if ((!deposit && !rental) || target.origin !== window.location.origin) return;
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url);
    setHostRoute(null);
    setAssetRoute(null);
    setPropertiesRoute(null);
    setRoomsRoute(null);
    setOccupancyRoute(null);
    setCatalogRoute(null);
    setPolicyRoute(null);
    setMeterRoute(null); setPeriodUsageRoute(null); setProvisionalRoute(null); setRentalProfileActive(false); setFundingRoute(null); setCustomerRoute(null);
    setContractRoute(deposit);
    setRentalContractRoute(rental);
    setTemplateRoute(null);
  }, [permitNavigation]);

  useEffect(() => {
    if (!assetRoute) return;
    const canonical = assetRouteKey(assetRoute);
    if (window.location.pathname + window.location.search !== canonical) window.history.replaceState(null, '', canonical);
  }, [assetRoute]);

  if (recovery.path === '/forgot-password') return <ForgotPasswordPage key={recoveryVisit} onLogin={() => navigateRecovery(null)} />;
  if (recovery.path === '/reset-password') return <ResetPasswordPage key={recoveryVisit} token={recovery.token}
    onLogin={() => navigateRecovery(null)} onNewRequest={() => navigateRecovery('/forgot-password')} onSuccess={finishRecovery} />;

  if (authCheck === 'checking') return <SessionSplash />;

  if (authCheck === 'error') return <main className="host-boot">
    <h1>{templateRoute ? 'Mẫu tài liệu' : rentalProfileActive ? rentalProfileTitle : fundingRoute ? fundingMessages.title : provisionalRoute ? provisionalMessages.title : customerRoute ? 'Quản lý khách thuê' : periodUsageRoute ? 'Số lượng, phí & giảm trừ' : catalogRoute || policyRoute ? 'Danh mục dịch vụ' : assetRoute ? 'Quản lý tài sản' : hostRoute ? 'Quản lý tài khoản Host' : 'RentOps'}</h1>
    <p role="alert">{customerRoute ? customerMessages.listFailure : catalogRoute || policyRoute ? catalogMessages.listFailure : assetRoute ? assetMessages.listFailure : hostRoute ? hostAccountMessages.listFailure : 'Chưa thể khôi phục phiên đăng nhập. Vui lòng kiểm tra kết nối rồi thử lại.'}</p>
    <button type="button" className="host-button" onClick={() => { setAuthCheck('checking'); setAuthRetry((n) => n + 1); }}>Thử lại</button>
    <button type="button" className="host-button" onClick={() => resetAuthentication()}>Đăng nhập lại</button>
  </main>;

  // 1. Màn hình Dashboard hiện có
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
        propertiesRoute={propertiesRoute}
        onNavigateProperties={navigateProperties}
        occupancyRoute={occupancyRoute}
        roomsRoute={roomsRoute}
        onNavigateRooms={navigateRoomWorkspace}
        contractRoute={contractRoute}
        onNavigateContracts={navigateContracts}
        rentalContractRoute={rentalContractRoute}
        onNavigateRentalContracts={navigateContracts}
        templateRoute={templateRoute}
        onNavigateTemplates={navigateTemplates}
        onCreatePendingChange={handleCreatePendingChange}
        onNavigateHost={navigateHost}
        onOverview={navigateOverview}
        catalogRoute={catalogRoute}
        onNavigateCatalog={navigateCatalog}
        policyRoute={policyRoute}
        onNavigatePolicy={navigatePolicy}
        meterRoute={meterRoute}
        onNavigateMeter={navigateMeter}
        periodUsageRoute={periodUsageRoute}
        onNavigatePeriodUsage={navigatePeriodUsage}
        fundingRoute={fundingRoute}
        onNavigateFunding={navigateFunding}
        rentalProfileActive={rentalProfileActive}
        onNavigateRentalProfile={navigateRentalProfile}
        provisionalRoute={provisionalRoute}
        onNavigateProvisional={navigateProvisional}
        customerRoute={customerRoute}
        onNavigateCustomers={navigateCustomers}
        onNavigatePath={navigateSpaPath}
        registerGuard={registerGuard}
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
