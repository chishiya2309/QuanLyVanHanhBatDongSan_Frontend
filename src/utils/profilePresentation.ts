import type { AccountRole } from '../types/auth';

export const profileRoleLabels: Record<AccountRole, string> = {
  ADMIN: 'Quản trị viên', HOST: 'Chủ cho thuê', CUSTOMER: 'Khách thuê',
};

export function profileInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase('vi-VN') || 'R';
}

export function profileBirthDate(value?: string | null): string {
  if (!value) return 'Chưa cập nhật';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function profileIdentityType(value?: string | null): string {
  if (!value) return 'Chưa cập nhật';
  return value === 'PASSPORT' ? 'Hộ chiếu' : value;
}
