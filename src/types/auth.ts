export type AccountRole = 'ADMIN' | 'HOST' | 'CUSTOMER';

export interface AuthenticatedUserResponse {
  accountId: string;
  loginName: string;
  role: AccountRole;
  hostId: string | null;
  customerId: string | null;
}

export interface LoginRequest {
  loginName: string;
  password: string;
}

export interface CsrfResponse {
  status: number;
  message: string;
  data: {
    token: string;
    headerName: string;
  };
}

export interface LoginFormData {
  loginName: string;
  password: string;
  rememberMe: boolean;
}

export type GoogleOnboardingPurpose = 'REGISTER_HOST' | 'SET_PASSWORD';
export interface GoogleOnboardingContext {
  flowId: string;
  purpose: GoogleOnboardingPurpose;
  email: string;
  suggestedName: string | null;
  expiresAt: string;
}
export interface GoogleOnboardingForm {
  fullName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}
export type GoogleOnboardingErrors = Partial<Record<keyof GoogleOnboardingForm, string>>;
export type GoogleRegisterRequest = GoogleOnboardingForm & { flowId: string };
export interface GooglePasswordRequest { flowId: string; password: string; confirmPassword: string }
export type GoogleOAuthStatus = 'success' | 'onboarding_required' | 'link_required' | 'cancelled'
  | 'account_locked' | 'email_not_supported' | 'conflict' | 'error';
export type LoginFieldErrors = Partial<Record<'loginName' | 'password', string>>;

export interface RegisterHostRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterHostResponse {
  status: number;
  message: string;
  data: null;
}

export interface ApiErrorResponse {
  timestamp?: string;
  status: number;
  path?: string;
  error?: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface RegisterHostFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export type FormFieldErrors = Partial<Record<keyof RegisterHostFormData, string>>;
