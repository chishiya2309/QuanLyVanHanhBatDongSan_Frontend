import type { BankDetails, FundingErrors, FundingFields, FundingSource, SupportedBank } from '../types/fundingSource';
export const fundingFields = (s?: FundingSource): FundingFields => ({ name: s?.name ?? '', bankCode: s?.bankDetails?.bankCode ?? '', accountNumber: s?.bankDetails?.accountNumber ?? '', accountHolder: s?.bankDetails?.accountHolder ?? '' });
export const fundingBank = (f: FundingFields): BankDetails => ({ bankCode: f.bankCode.trim().toUpperCase(), accountNumber: f.accountNumber.trim(), accountHolder: f.accountHolder.trim() });
export function validateFundingFields(fields: FundingFields, bank: boolean, banks?: SupportedBank[]): FundingErrors {
  const errors: FundingErrors = {};
  if (!fields.name.trim() || [...fields.name.trim()].length > 100) errors.name = 'Tên nguồn tiền phải có từ 1 đến 100 ký tự.';
  if (bank) {
    if (!fields.bankCode.trim() || banks && !banks.some(b => b.bankCode === fields.bankCode.trim().toUpperCase())) errors.bankCode = 'Vui lòng chọn ngân hàng được hệ thống hỗ trợ.';
    if (!/^[0-9]{6,25}$/.test(fields.accountNumber.trim())) errors.accountNumber = 'Số tài khoản phải gồm 6 đến 25 chữ số, giữ nguyên số 0 đầu.';
    if (!fields.accountHolder.trim() || [...fields.accountHolder.trim()].length > 255) errors.accountHolder = 'Tên chủ tài khoản không được rỗng và tối đa 255 ký tự.';
  }
  return errors;
}
