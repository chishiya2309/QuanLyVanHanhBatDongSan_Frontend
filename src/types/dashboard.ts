import type { AccountRole } from './auth';

export type UserRole = AccountRole;

export interface PropertyOption {
  id: string;
  name: string;
  address: string;
  totalRooms: number;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl?: string;
  role: UserRole;
  managedProperties: PropertyOption[];
}

export interface OverviewMetrics {
  occupancyRate: number; // e.g. 92%
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  monthlyRevenueActual: number; // e.g. 145000000
  monthlyRevenueExpected: number; // e.g. 158000000
  revenueGrowthMoM: number; // e.g. +6.8%
  pendingIssuesCount: number; // e.g. 4
  urgentIssuesCount: number; // e.g. 1
  expiringContractsCount: number; // e.g. 7
  expiringDaysWindow: number; // e.g. 30
}

export interface RevenueMonthlyPoint {
  month: string; // e.g. "T5/26"
  actual: number; // in VND
  expected: number; // in VND
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface UrgentAlertItem {
  id: string;
  roomNumber: string;
  propertyName: string;
  category: 'MAINTENANCE' | 'OVERDUE_PAYMENT' | 'CHECKOUT_REQUEST' | 'EXPIRING_CONTRACT';
  title: string;
  description: string;
  severity: AlertSeverity;
  daysDiffText: string;
  actionText: string;
}

export type RoomAttentionStatus = 'VACANT' | 'OVERDUE' | 'MAINTENANCE' | 'EXPIRING';

export interface RoomAttentionItem {
  id: string;
  roomNumber: string;
  propertyName: string;
  floor: number;
  tenantName: string | null;
  tenantPhone: string | null;
  status: RoomAttentionStatus;
  statusLabel: string;
  monthlyRent: number; // in VND
  overdueDays?: number;
  daysUntilExpiry?: number;
  issueNote?: string;
}
