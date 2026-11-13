import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FloorModal } from '../src/components/properties/FloorModal';
import { AreaModal, BuildingModal, ChangeBuildingAreaModal } from '../src/components/properties/PropertiesModals';
import { PropertiesPage } from '../src/components/properties/PropertiesPage';
import { RoomDetailDrawer } from '../src/components/properties/RoomDetailDrawer';
import { RoomModal } from '../src/components/properties/RoomModal';
import { RoomsPage } from '../src/components/properties/RoomsPage';
import type { Area, Building, Floor, RoomDetail } from '../src/types/properties';
import { deferred, failure, ok } from './apiMock';

const area: Area = { id: 'a1', name: 'Khu A', description: null, active: true, createdAt: '', updatedAt: '' };
const building: Building = { id: 'b1', areaId: area.id, areaName: area.name, name: 'Tòa A', address: 'Địa chỉ A', active: true, createdAt: '', updatedAt: '' };
const floor: Floor = { id: 'f1', buildingId: building.id, name: 'Tầng trệt', level: 0, roomCount: 1, createdAt: '', updatedAt: '' };
const room: RoomDetail = { id: 'r1', buildingId: building.id, floorId: floor.id, code: 'P101', name: 'Phòng A', area: 28, defaultRent: 0, defaultDeposit: 0, maintenance: false, status: 'VACANT', canEditBasicInfo: true, hasActiveContractOrReservation: false };
const formProps = () => ({ isOpen: true, isPending: false, error: null, fieldErrors: {}, onClose: vi.fn(), onSubmit: vi.fn() });
const value = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;
const change = (label: string | RegExp, next: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: next } });

describe('property forms preserve drafts and reset between editing sessions', () => {
  it('initializes the area form from its record and resets after close or record change', () => {
    const props = { ...formProps(), area };
    const view = render(<AreaModal {...props} />);
    expect(value('Tên khu vực (*)')).toBe(area.name);
    change('Tên khu vực (*)', 'Bản nháp');
    view.rerender(<AreaModal {...props} isOpen={false} />);
    view.rerender(<AreaModal {...props} />);
    expect(value('Tên khu vực (*)')).toBe(area.name);
    view.rerender(<AreaModal {...props} area={{ ...area, id: 'a2', name: 'Khu B' }} />);
    expect(value('Tên khu vực (*)')).toBe('Khu B');
    view.rerender(<AreaModal {...props} area={null} />);
    expect(value('Tên khu vực (*)')).toBe('');
  });

  it('keeps floor level zero and resets the floor form when reopened or switched to create', () => {
    const props = { ...formProps(), buildingId: building.id, floor };
    const view = render(<FloorModal {...props} />);
    expect(value('Cấp tầng (Level số nguyên) (*)')).toBe('0');
    change('Tên tầng (*)', 'Bản nháp');
    view.rerender(<FloorModal {...props} isOpen={false} />);
    view.rerender(<FloorModal {...props} />);
    expect(value('Tên tầng (*)')).toBe(floor.name);
    view.rerender(<FloorModal {...props} floor={null} />);
    expect(value('Tên tầng (*)')).toBe('');
    expect(value('Cấp tầng (Level số nguyên) (*)')).toBe('1');
  });

  it('selects areas arriving asynchronously without erasing a new building draft', () => {
    const props = { ...formProps(), building: null, activeAreas: [] as Area[] };
    const view = render(<BuildingModal {...props} />);
    change('Tên tòa nhà (*)', 'Tòa mới');
    change('Địa chỉ tòa nhà (*)', 'Địa chỉ mới');
    view.rerender(<BuildingModal {...props} activeAreas={[area]} />);
    expect(value('Tên tòa nhà (*)')).toBe('Tòa mới');
    expect(value('Khu vực trực thuộc (*)')).toBe(area.id);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tòa nhà' }));
    expect(props.onSubmit).toHaveBeenCalledWith({ areaId: area.id, name: 'Tòa mới', address: 'Địa chỉ mới' });
    view.rerender(<BuildingModal {...props} isOpen={false} />);
    view.rerender(<BuildingModal {...props} activeAreas={[area]} />);
    expect(value('Tên tòa nhà (*)')).toBe('');
  });

  it('preserves a valid target area across refreshes and falls back when it is removed', () => {
    const areaB = { ...area, id: 'a2', name: 'Khu B' };
    const areaC = { ...area, id: 'a3', name: 'Khu C' };
    const props = { ...formProps(), building, activeAreas: [area, areaB, areaC, { ...area, id: 'inactive', active: false }] };
    const view = render(<ChangeBuildingAreaModal {...props} />);
    expect(screen.queryByRole('option', { name: area.name })).toBeNull();
    expect(value('Khu vực chuyển đến (*)')).toBe(areaB.id);
    change('Khu vực chuyển đến (*)', areaC.id);
    view.rerender(<ChangeBuildingAreaModal {...props} activeAreas={props.activeAreas.map((item) => ({ ...item }))} />);
    expect(value('Khu vực chuyển đến (*)')).toBe(areaC.id);
    view.rerender(<ChangeBuildingAreaModal {...props} activeAreas={[area, areaB]} />);
    expect(value('Khu vực chuyển đến (*)')).toBe(areaB.id);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển khu vực' }));
    expect(props.onSubmit).toHaveBeenCalledWith({ targetAreaId: areaB.id });
  });

  it('keeps the room draft when floors arrive or refresh and resets when reopened', () => {
    const props = { ...formProps(), buildingId: building.id, floors: [] as Floor[], roomDetail: null, onOpenAddFloor: vi.fn() };
    const view = render(<RoomModal {...props} />);
    change('Mã phòng (*)', 'P202');
    change('Tên phòng (*)', 'Phòng mới');
    view.rerender(<RoomModal {...props} floors={[floor]} />);
    expect(value('Tầng trực thuộc (*)')).toBe(floor.id);
    const upperFloor = { ...floor, id: 'f2', name: 'Tầng 2', level: 2 };
    view.rerender(<RoomModal {...props} floors={[floor, upperFloor]} />);
    change('Tầng trực thuộc (*)', upperFloor.id);
    view.rerender(<RoomModal {...props} floors={[{ ...floor }, { ...upperFloor }]} />);
    expect(value('Mã phòng (*)')).toBe('P202');
    expect(value('Tầng trực thuộc (*)')).toBe(upperFloor.id);
    fireEvent.click(screen.getByRole('button', { name: 'Khai báo phòng' }));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ floorId: upperFloor.id, code: 'P202', name: 'Phòng mới' }));
    view.rerender(<RoomModal {...props} isOpen={false} />);
    view.rerender(<RoomModal {...props} floors={[floor]} />);
    expect(value('Mã phòng (*)')).toBe('');
  });

  it('preserves zero prices and submits only allowed fields for a locked room', () => {
    const props = { ...formProps(), buildingId: building.id, floors: [floor], roomDetail: { ...room, canEditBasicInfo: false }, onOpenAddFloor: vi.fn() };
    render(<RoomModal {...props} />);
    expect((screen.getByLabelText(/Mã phòng/) as HTMLInputElement).disabled).toBe(true);
    expect(value('Giá thuê mặc định (VNĐ/tháng) (*)')).toBe('0');
    expect(value('Tiền cọc mặc định (VNĐ) (*)')).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(props.onSubmit).toHaveBeenCalledWith({ defaultRent: 0, defaultDeposit: 0 });
  });
});

describe('property requests follow the current page and drawer', () => {
  it('discards the old room response when another room is opened', async () => {
    const oldDetail = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith('/r1/detail')) return oldDetail.promise;
      if (path.endsWith('/r2/detail')) return ok({ ...room, id: 'r2', code: 'P202' });
      return ok({ tenancyHistory: [], stateHistory: [] });
    }));
    const props = { isOpen: true, roomId: 'r1', onClose: vi.fn(), onEditRoom: vi.fn(), onSessionExpired: vi.fn() };
    const view = render(<RoomDetailDrawer {...props} />);
    expect(screen.getByText('Đang tải thông tin chi tiết…')).toBeTruthy();
    view.rerender(<RoomDetailDrawer {...props} roomId="r2" />);
    await screen.findByRole('heading', { name: 'Phòng: P202' });
    await act(async () => oldDetail.resolve(ok(room)));
    expect(screen.queryByRole('heading', { name: 'Phòng: P101' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Phòng: P202' })).toBeTruthy();
  });

  it('resets the drawer tab on reopening and ignores an expired response after close', async () => {
    const pending = deferred<Response>();
    let expired = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/detail')
      ? expired ? pending.promise : ok(room)
      : ok({ tenancyHistory: [], stateHistory: [] })));
    const props = { isOpen: true, roomId: room.id, initialTab: 'history' as const, onClose: vi.fn(), onEditRoom: vi.fn(), onSessionExpired: vi.fn() };
    const view = render(<RoomDetailDrawer {...props} />);
    await screen.findByText('Chưa có biến động trạng thái nào được ghi nhận.');
    fireEvent.click(screen.getByRole('button', { name: 'Thông tin cấu hình' }));
    view.rerender(<RoomDetailDrawer {...props} isOpen={false} />);
    expired = true;
    view.rerender(<RoomDetailDrawer {...props} />);
    expect(screen.getByRole('button', { name: /Biến động trạng thái/ }).classList.contains('is-active')).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Phòng: P101' })).toBeNull();
    view.rerender(<RoomDetailDrawer {...props} isOpen={false} />);
    await act(async () => pending.resolve(failure(401, 'Expired')));
    expect(props.onSessionExpired).not.toHaveBeenCalled();
  });

  it('shows initial and manual reload progress and ignores bootstrap results after unmount', async () => {
    const initial = deferred<Response>();
    const reload = deferred<Response>();
    const pending = deferred<Response>();
    const areas = vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(reload.promise).mockReturnValueOnce(pending.promise);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/areas') ? areas() : ok([])));
    const props = { route: { tab: 'areas' as const }, onNavigate: vi.fn(), onNavigateRooms: vi.fn(), onSessionExpired: vi.fn() };
    const view = render(<PropertiesPage {...props} />);
    expect(screen.getByText('Đang tải danh sách khu vực...')).toBeTruthy();
    await act(async () => initial.resolve(ok([area])));
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(screen.getByText('Đang tải danh sách khu vực...')).toBeTruthy();
    await act(async () => reload.resolve(ok([])));
    await screen.findByText('Chưa có khu vực nào');
    view.unmount();
    const second = render(<PropertiesPage {...props} />);
    second.unmount();
    await act(async () => pending.resolve(failure(401, 'Expired')));
    expect(props.onSessionExpired).not.toHaveBeenCalled();
  });

  it('keeps the current building floors and overview when older responses arrive late', async () => {
    const oldFloors = deferred<Response>();
    const oldOverview = deferred<Response>();
    const nextFloor = { ...floor, id: 'f2', buildingId: 'b2', name: 'Tầng B' };
    const overview = (buildingId: string, code: string) => ({ buildingId, buildingName: buildingId, address: '', floors: [{ floorId: buildingId, floorName: buildingId, floorLevel: 1, rooms: [{ id: buildingId, code, name: code, status: 'VACANT', isMaintenance: false }] }] });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith('/buildings')) return ok([building, { ...building, id: 'b2', name: 'Tòa B' }]);
      if (path.endsWith('/b1/floors')) return oldFloors.promise;
      if (path.endsWith('/b1/overview')) return oldOverview.promise;
      if (path.endsWith('/b2/floors')) return ok([nextFloor]);
      if (path.endsWith('/b2/overview')) return ok(overview('b2', 'P202'));
      return ok([]);
    }));
    render(<RoomsPage route={{ view: 'matrix', buildingId: 'b1' }} onNavigate={vi.fn()} onSessionExpired={vi.fn()} />);
    expect(screen.getByText('Đang tải sơ đồ tầng và phòng...')).toBeTruthy();
    await screen.findByRole('option', { name: /Tòa B/ });
    change('Tòa nhà:', 'b2');
    await screen.findByText('P202', { selector: '.room-card-code' });
    fireEvent.click(screen.getByRole('button', { name: '+ Khai báo phòng' }));
    await screen.findByRole('option', { name: /Tầng B/ });
    await act(async () => { oldFloors.resolve(ok([floor])); oldOverview.resolve(ok(overview('b1', 'P101'))); });
    expect(screen.queryByText('P101', { selector: '.room-card-code' })).toBeNull();
    expect(screen.queryByRole('option', { name: /Tầng trệt/ })).toBeNull();
    expect(value('Tầng trực thuộc (*)')).toBe(nextFloor.id);
  });

  it('keeps the newest search results when an earlier filter request finishes later', async () => {
    const initial = deferred<Response>();
    const filtered = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/rooms/search')) return url.searchParams.has('keyword') ? filtered.promise : initial.promise;
      return ok([]);
    }));
    render(<RoomsPage route={{ view: 'table' }} onNavigate={vi.fn()} onSessionExpired={vi.fn()} />);
    expect(screen.getByText('Đang tra cứu danh sách phòng...')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Tìm theo mã hoặc tên phòng...'), { target: { value: 'P202' } });
    await act(async () => filtered.resolve(ok([{ ...room, code: 'P202' }])));
    await screen.findByText('P202', { selector: 'strong' });
    await act(async () => initial.resolve(ok([room])));
    expect(screen.queryByText('P101', { selector: 'strong' })).toBeNull();
    expect(screen.getByText('P202', { selector: 'strong' })).toBeTruthy();
  });
});
