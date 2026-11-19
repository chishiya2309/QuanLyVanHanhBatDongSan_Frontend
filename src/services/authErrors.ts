export class AuthApiError extends Error {
  status: number;
  readonly code?: string;
  fieldErrors?: Record<string, string>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string>, code?: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
