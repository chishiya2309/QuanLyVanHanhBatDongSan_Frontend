import type { GoogleOnboardingErrors, GoogleOnboardingForm, GoogleOnboardingPurpose } from '../types/auth';
import { isValidPhoneNumber } from '../utils/phoneNumber';
export function validateGoogleOnboarding(data: GoogleOnboardingForm, purpose: GoogleOnboardingPurpose): GoogleOnboardingErrors {
  const errors: GoogleOnboardingErrors = {};
  if (purpose === 'REGISTER_HOST') {
    if (!data.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên hoặc tên kinh doanh';
    else if (data.fullName.trim().length > 255) errors.fullName = 'Tên không được vượt quá 255 ký tự';
    if (!data.phoneNumber.trim()) errors.phoneNumber = 'Vui lòng nhập số điện thoại';
    else if (!isValidPhoneNumber(data.phoneNumber)) errors.phoneNumber = 'Số điện thoại không hợp lệ';
  }
  if (!data.password || !data.password.trim()) errors.password = 'Vui lòng nhập mật khẩu';
  else if (data.password.length < 8) errors.password = 'Mật khẩu phải có tối thiểu 8 ký tự';
  else if (new TextEncoder().encode(data.password).length > 72) errors.password = 'Mật khẩu không được vượt quá 72 byte UTF-8';
  if (!data.confirmPassword || !data.confirmPassword.trim()) errors.confirmPassword = 'Vui lòng nhập xác nhận mật khẩu';
  else if (data.confirmPassword !== data.password) errors.confirmPassword = 'Xác nhận mật khẩu không trùng khớp';
  return errors;
}
