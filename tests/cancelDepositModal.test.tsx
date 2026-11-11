import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CancelDepositModal } from '../src/components/contracts/CancelDepositModal';
import * as api from '../src/services/depositContractApi';
import type { DepositContract } from '../src/types/depositContract';

const mockContract: DepositContract = {
  id: 'c1234567-89ab-cdef-0123-456789abcdef',
  contractNumber: 'HDC-20261111-TEST',
  status: 'RESERVED',
  customerId: 'cust-1',
  customerName: 'Nguyễn Văn Test',
  roomId: 'room-1',
  roomCode: 'P101',
  roomName: 'Phòng 101',
  buildingName: 'Tòa Landmark',
  floorLevel: 1,
  amountRequired: 3000000,
  reservedFrom: '2026-11-11',
  moveInDate: '2026-11-18',
  createdAt: '2026-11-11T00:00:00Z',
  updatedAt: '2026-11-11T00:00:00Z',
};

describe('CancelDepositModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary information and warning box when open', () => {
    render(
      <CancelDepositModal
        isOpen={true}
        contract={mockContract}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('HDC-20261111-TEST')).toBeDefined();
    expect(screen.getByText('Nguyễn Văn Test')).toBeDefined();
    expect(screen.getAllByText(/P101/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3\.000\.000/)).toBeDefined();
    expect(screen.getByText(/ĐANG TRỐNG \(VACANT\)/)).toBeDefined();
  });

  it('shows validation error when reason is empty on submit', async () => {
    render(
      <CancelDepositModal
        isOpen={true}
        contract={mockContract}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Xác nhận hủy đặt cọc/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Vui lòng nhập lý do hủy đặt cọc')).toBeDefined();
  });

  it('calls cancelDepositContract API and triggers onSuccess when valid reason entered', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    vi.spyOn(api, 'cancelDepositContract').mockResolvedValueOnce({
      ...mockContract,
      status: 'CANCELLED',
      cancelReason: 'Khách đổi ý',
      cancelledAt: '2026-11-11T08:00:00Z',
    });

    render(
      <CancelDepositModal
        isOpen={true}
        contract={mockContract}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const textarea = screen.getByPlaceholderText(/Nhập lý do khách hủy/i);
    fireEvent.change(textarea, { target: { value: 'Khách đổi ý không thuê' } });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận hủy đặt cọc/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.cancelDepositContract).toHaveBeenCalledWith(
        'c1234567-89ab-cdef-0123-456789abcdef',
        'Khách đổi ý không thuê'
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
