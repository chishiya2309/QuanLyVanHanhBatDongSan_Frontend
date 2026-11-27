import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashLedgerPage } from '../src/components/cash-ledger/CashLedgerPage';
import * as cashLedgerApi from '../src/services/cashLedgerApi';
import * as fundingApi from '../src/services/fundingApi';
import * as propertiesApi from '../src/services/propertiesApi';
import type { CashLedgerDetail, CashLedgerPageData } from '../src/types/cashLedger';
import type { FinanceRoute } from '../src/utils/financeNavigation';

vi.mock('../src/services/cashLedgerApi', async () => {
  const actual = await vi.importActual<typeof cashLedgerApi>('../src/services/cashLedgerApi');
  return {
    ...actual,
    fetchCashLedger: vi.fn(),
    fetchCashLedgerDetail: vi.fn(),
    fetchAttachmentBlob: vi.fn(),
  };
});

vi.mock('../src/services/fundingApi', () => ({
  listFundingSources: vi.fn(),
}));

vi.mock('../src/services/propertiesApi', () => ({
  getAreas: vi.fn(),
  getBuildings: vi.fn(),
  getRoomsByBuilding: vi.fn(),
}));

const baseRoute: FinanceRoute = {
  kind: 'cash-ledger',
  filter: { transactionCategory: [] },
  page: 0,
  size: 20,
};

const samplePage: CashLedgerPageData = {
  page: 0,
  size: 20,
  totalElements: 1,
  summary: {
    totalIncome: 3000000n,
    totalExpense: 500000n,
    netCashFlow: 2500000n,
    estimatedProfit: 2500000n,
  },
  items: [
    {
      id: 'entry-1',
      sourceId: 'src-1',
      amount: 3000000n,
      direction: 'IN',
      origin: 'INVOICE_PAYMENT',
      category: 'RENT',
      categoryName: 'Tiền thuê',
      sourceName: 'Vietcombank',
      sourceType: 'BANK',
      scopeLabel: 'Phòng P101',
      occurredAt: '2026-11-15T10:00:00Z',
      adjustments: [],
      reportDirection: 'IN',
      reportAmount: 3000000n,
      affectsProfit: true,
      isReversal: false,
      isReversed: false,
      hasAttachments: true,
      attachmentCount: 1,
    },
  ],
};

describe('CashLedgerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fundingApi.listFundingSources).mockResolvedValue([]);
    vi.mocked(propertiesApi.getAreas).mockResolvedValue([]);
    vi.mocked(propertiesApi.getBuildings).mockResolvedValue([]);
    vi.mocked(propertiesApi.getRoomsByBuilding).mockResolvedValue([]);
  });

  it('renders 4 summary cards and table entries', async () => {
    vi.mocked(cashLedgerApi.fetchCashLedger).mockResolvedValue(samplePage);

    render(<CashLedgerPage route={baseRoute} onNavigate={vi.fn()} onSessionExpired={vi.fn()} />);

    expect(await screen.findByText('Tổng thu')).toBeTruthy();
    expect(screen.getByText('Tổng chi')).toBeTruthy();
    expect(screen.getByText('Dòng tiền ròng')).toBeTruthy();
    expect(screen.getByText('Lợi nhuận tạm tính')).toBeTruthy();
    expect(screen.getByText('Phòng P101')).toBeTruthy();
  });

  it('shows E5a inline error when fromDate > toDate and keeps previous results', async () => {
    vi.mocked(cashLedgerApi.fetchCashLedger).mockResolvedValue(samplePage);

    render(<CashLedgerPage route={baseRoute} onNavigate={vi.fn()} onSessionExpired={vi.fn()} />);
    await screen.findByText('Phòng P101');

    fireEvent.change(screen.getByLabelText('Từ ngày (phát sinh)'), { target: { value: '2026-11-25' } });
    fireEvent.change(screen.getByLabelText('Đến ngày (phát sinh)'), { target: { value: '2026-11-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lọc dữ liệu' }));

    expect(
      screen.getByText('Khoảng thời gian không hợp lệ. Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc'),
    ).toBeTruthy();
    expect(screen.getByText('Phòng P101')).toBeTruthy();
    expect(cashLedgerApi.fetchCashLedger).toHaveBeenCalledTimes(1);
  });

  it('renders NO_DATA and NO_MATCH empty states', async () => {
    vi.mocked(cashLedgerApi.fetchCashLedger).mockResolvedValueOnce({
      items: [],
      page: 0,
      size: 20,
      totalElements: 0,
      summary: { totalIncome: 0n, totalExpense: 0n, netCashFlow: 0n, estimatedProfit: 0n },
      emptyState: 'NO_DATA',
      emptyMessage: 'Chưa có giao dịch thu chi nào được ghi nhận trong sổ quỹ',
    });

    render(<CashLedgerPage route={baseRoute} onNavigate={vi.fn()} onSessionExpired={vi.fn()} />);
    expect(await screen.findByText('Chưa có giao dịch thu chi nào được ghi nhận trong sổ quỹ')).toBeTruthy();
  });

  it('opens detail drawer for invoice payment (8a) and closes on Escape', async () => {
    vi.mocked(cashLedgerApi.fetchCashLedger).mockResolvedValue(samplePage);
    const detail: CashLedgerDetail = {
      id: 'entry-1',
      voucherCode: 'PT-HD-1234',
      occurredAt: '2026-11-15T10:00:00Z',
      recordedAt: '2026-11-15T10:01:00Z',
      direction: 'IN',
      amount: 3000000n,
      categoryName: 'Tiền thuê',
      sourceName: 'Vietcombank',
      sourceType: 'BANK',
      scopeLabel: 'Phòng P101',
      affectsProfit: true,
      origin: 'INVOICE_PAYMENT',
      invoiceId: 'inv-99',
      invoiceNumber: 'HD-202611-001',
      isReversal: false,
      isReversed: false,
      attachments: [],
    };
    vi.mocked(cashLedgerApi.fetchCashLedgerDetail).mockResolvedValue(detail);
    const onOpenInvoice = vi.fn();

    render(
      <CashLedgerPage
        route={baseRoute}
        onNavigate={vi.fn()}
        onSessionExpired={vi.fn()}
        onOpenInvoice={onOpenInvoice}
      />,
    );

    const detailBtn = await screen.findByRole('button', { name: 'Xem chi tiết' });
    fireEvent.click(detailBtn);

    expect(await screen.findByText('Chứng từ PT-HD-1234')).toBeTruthy();
    expect(screen.getByText('HD-202611-001')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem hóa đơn liên quan' }));
    expect(onOpenInvoice).toHaveBeenCalledWith('inv-99');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('renders 403 forbidden alert when access is denied (E1a)', async () => {
    vi.mocked(cashLedgerApi.fetchCashLedger).mockRejectedValue(
      new cashLedgerApi.CashLedgerApiError(403, 'Bạn không có quyền truy cập vào sổ thu chi này'),
    );

    render(<CashLedgerPage route={baseRoute} onNavigate={vi.fn()} onSessionExpired={vi.fn()} />);
    expect(await screen.findByText('Bạn không có quyền truy cập vào sổ thu chi này')).toBeTruthy();
  });
});
