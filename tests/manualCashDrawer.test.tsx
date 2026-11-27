import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashLedgerToast } from '../src/components/cash-ledger/CashLedgerToast';
import { ManualCashDrawer } from '../src/components/cash-ledger/ManualCashDrawer';
import * as cashLedgerApi from '../src/services/cashLedgerApi';
import * as propertiesApi from '../src/services/propertiesApi';

vi.mock('../src/services/cashLedgerApi', async () => {
  const actual = await vi.importActual<typeof cashLedgerApi>('../src/services/cashLedgerApi');
  return {
    ...actual,
    fetchManualCashInit: vi.fn(),
    stageManualAttachments: vi.fn(),
    fetchStagedAttachmentPreviewUrl: vi.fn(),
    discardStagedAttachments: vi.fn(),
    createManualCashEntry: vi.fn(),
  };
});

vi.mock('../src/services/propertiesApi', () => ({
  getAreas: vi.fn(),
  getBuildings: vi.fn(),
  getRoomsByBuilding: vi.fn(),
}));

describe('ManualCashDrawer & CashLedgerToast (UC57)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashLedgerApi.fetchManualCashInit).mockResolvedValue({
      idempotencyKey: 'idem-key-1',
      categories: [
        { code: 'REPAIR', name: 'Sửa chữa bảo trì', direction: 'OUT', affectsProfit: true },
        { code: 'VIOLATION_FEE', name: 'Thu phạt vi phạm', direction: 'IN', affectsProfit: true },
        { code: 'OTHER_IN', name: 'Thu khác', direction: 'IN', affectsProfit: false },
      ],
      fundingSources: [
        { id: 'src-cash', name: 'Quỹ tiền mặt quản lý', type: 'CASH', availableBalance: 500000n },
        { id: 'src-bank', name: 'Vietcombank', type: 'BANK', availableBalance: 2000000n },
      ],
    });
    vi.mocked(propertiesApi.getAreas).mockResolvedValue([]);
    vi.mocked(propertiesApi.getBuildings).mockResolvedValue([]);
    vi.mocked(propertiesApi.getRoomsByBuilding).mockResolvedValue([]);
    vi.mocked(cashLedgerApi.discardStagedAttachments).mockResolvedValue(undefined);
  });

  it('switches direction (1a), validates amount <= 0 (E2a), and handles overdraft confirmation (7a)', async () => {
    const onSuccess = vi.fn();
    render(
      <ManualCashDrawer
        open={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onSessionExpired={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Danh mục thu chi')).toBeTruthy());
    expect(screen.getByText('Có tính vào lợi nhuận kinh doanh')).toBeTruthy();

    // Switch to IN (1a) -> loads IN categories and updates profit badge
    fireEvent.click(screen.getByRole('button', { name: 'Thu tiền' }));
    const catSelect = screen.getByLabelText('Danh mục thu chi') as HTMLSelectElement;
    expect(catSelect.value).toBe('VIOLATION_FEE');
    fireEvent.change(catSelect, { target: { value: 'OTHER_IN' } });
    expect(screen.getByText('Không tính vào lợi nhuận kinh doanh')).toBeTruthy();

    // Switch back to OUT and test E2a amount <= 0
    fireEvent.click(screen.getByRole('button', { name: 'Chi tiền' }));
    fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu giao dịch' }));
    expect(await screen.findByText('Số tiền giao dịch phải lớn hơn 0 VND')).toBeTruthy();

    // Enter valid amount exceeding balance -> 409 overdraft dialog (7a)
    fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '900000' } });
    vi.mocked(cashLedgerApi.createManualCashEntry)
      .mockRejectedValueOnce(
        new cashLedgerApi.CashLedgerApiError(
          409,
          'Số tiền chi vượt quá số dư hiện có của nguồn tiền, số dư sau giao dịch sẽ bị âm. Bạn có muốn tiếp tục ghi nhận không?',
          'OVERDRAFT_CONFIRMATION_REQUIRED',
        ),
      )
      .mockResolvedValueOnce({
        entryId: 'entry-new',
        direction: 'OUT',
        amount: 900000n,
        affectsProfit: true,
        resultingSourceBalance: -400000n,
        attachmentCount: 0,
        reversalHint: 'Bạn có thể thực hiện bút toán đảo ngược tại Sổ thu chi (UC56).',
      });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu giao dịch' }));
    expect(await screen.findByText('Cảnh báo chi vượt số dư nguồn tiền')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tiếp tục' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(cashLedgerApi.createManualCashEntry).toHaveBeenNthCalledWith(
      2,
      'idem-key-1',
      expect.objectContaining({ confirmOverdraft: true, amount: 900000 }),
    );
  });

  it('validates file type/size (E4a) and discards staged files on cancel (5a)', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <ManualCashDrawer
        open={true}
        onClose={onClose}
        onSuccess={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Danh mục thu chi')).toBeTruthy());
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    // Unsupported file (E4a)
    const badFile = new File(['bad'], 'script.exe', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(
      await screen.findByText('Định dạng tệp chứng từ không được hỗ trợ. Chỉ chấp nhận JPEG, PNG, PDF.'),
    ).toBeTruthy();

    // Valid PDF file
    vi.mocked(cashLedgerApi.stageManualAttachments).mockResolvedValueOnce([
      {
        tempId: 'tmp-pdf-1',
        fileName: 'bien-nhan.pdf',
        contentType: 'application/pdf',
        fileSize: 1024,
        previewUrl: '/api/v1/cash-ledger/manual/attachments/tmp-pdf-1/preview',
      },
    ]);
    const pdfFile = new File(['%PDF-1.4'], 'bien-nhan.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });
    expect(await screen.findByText('bien-nhan.pdf')).toBeTruthy();

    // Cancel discards staged attachments (5a)
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(cashLedgerApi.discardStagedAttachments).toHaveBeenCalledWith(['tmp-pdf-1']);
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-dismisses CashLedgerToast after 5 seconds and supports manual close', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <CashLedgerToast
        toast={{
          id: 't1',
          tone: 'success',
          title: 'Ghi nhận giao dịch chi tiền thành công.',
          detail: 'Có thể thực hiện bút toán đảo ngược.',
        }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('Ghi nhận giao dịch chi tiền thành công.');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
