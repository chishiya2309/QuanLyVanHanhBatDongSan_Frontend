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
