import { AuthApiError, clearCsrfCache, getCsrfToken } from './authApi';
import type {
  Area,
  CreateAreaInput,
  UpdateAreaInput,
  Building,
  CreateBuildingInput,
  UpdateBuildingInput,
  ChangeBuildingAreaInput,
  Floor,
  CreateFloorInput,
  UpdateFloorInput,
  Room,
  RoomDetail,
  RoomSearchItem,
  BuildingOverview,
  CreateRoomInput,
  UpdateRoomInput,
  RoomHistory,
  RoomFilterParams,
} from '../types/properties';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class PropertyApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'PropertyApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const status = response.status;
    let message = 'Đã có lỗi xảy ra. Vui lòng thử lại';
    const fieldErrors: Record<string, string> = {};

    if (json && typeof json === 'object') {
      if (typeof json.message === 'string') {
        message = json.message;
      }
      if (json.fieldErrors && typeof json.fieldErrors === 'object') {
        for (const [k, v] of Object.entries(json.fieldErrors)) {
          if (typeof v === 'string') fieldErrors[k] = v;
        }
      }
    }

    if (status === 401) {
      message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại';
    } else if (status === 403 && message.includes('CSRF')) {
      clearCsrfCache();
    }

    throw new PropertyApiError(status, message, fieldErrors);
  }

  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as unknown as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });
  return handleResponse<T>(response);
}

async function mutate<T>(path: string, method: 'POST' | 'PUT' | 'PATCH', body?: unknown): Promise<T> {
  let headerName: string;
  let token: string;

  try {
    const csrf = await getCsrfToken();
    headerName = csrf.headerName;
    token = csrf.token;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      throw new PropertyApiError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại');
    }
    clearCsrfCache();
    throw new PropertyApiError(0, 'Không thể xác thực bảo mật CSRF. Vui lòng thử lại sau');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [headerName]: token,
  };

  const options: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  return request<T>(path, options);
}

// ==========================================
// UC10: Quản lý khu vực (Area Management)
// ==========================================
export async function getAreas(): Promise<Area[]> {
  return request<Area[]>('/areas');
}

export async function createArea(input: CreateAreaInput): Promise<Area> {
  return mutate<Area>('/areas', 'POST', input);
}

export async function updateArea(id: string, input: UpdateAreaInput): Promise<Area> {
  return mutate<Area>(`/areas/${encodeURIComponent(id)}`, 'PUT', input);
}

export async function deactivateArea(id: string): Promise<void> {
  return mutate<void>(`/areas/${encodeURIComponent(id)}/deactivate`, 'PATCH');
}

export async function activateArea(id: string): Promise<void> {
  return mutate<void>(`/areas/${encodeURIComponent(id)}/activate`, 'PATCH');
}

// ==========================================
// UC11 & UC12: Quản lý tòa nhà (Building Management)
// ==========================================
export async function getActiveAreas(): Promise<Area[]> {
  return request<Area[]>('/buildings/active-areas');
}

export async function getBuildings(): Promise<Building[]> {
  return request<Building[]>('/buildings');
}

export async function getBuilding(id: string): Promise<Building> {
  return request<Building>(`/buildings/${encodeURIComponent(id)}`);
}

export async function createBuilding(input: CreateBuildingInput): Promise<Building> {
  return mutate<Building>('/buildings', 'POST', input);
}

export async function updateBuilding(id: string, input: UpdateBuildingInput): Promise<Building> {
  return mutate<Building>(`/buildings/${encodeURIComponent(id)}`, 'PUT', input);
}

export async function changeBuildingArea(id: string, input: ChangeBuildingAreaInput): Promise<Building> {
  return mutate<Building>(`/buildings/${encodeURIComponent(id)}/area`, 'PATCH', input);
}

export async function deactivateBuilding(id: string): Promise<void> {
  return mutate<void>(`/buildings/${encodeURIComponent(id)}/deactivate`, 'PATCH');
}

export async function activateBuilding(id: string): Promise<void> {
  return mutate<void>(`/buildings/${encodeURIComponent(id)}/activate`, 'PATCH');
}

// ==========================================
// UC13: Tầng (Floor Management)
// ==========================================
export async function getFloors(buildingId: string): Promise<Floor[]> {
  return request<Floor[]>(`/buildings/${encodeURIComponent(buildingId)}/floors`);
}

export async function createFloor(buildingId: string, input: CreateFloorInput): Promise<Floor> {
  return mutate<Floor>(`/buildings/${encodeURIComponent(buildingId)}/floors`, 'POST', input);
}

export async function updateFloor(buildingId: string, floorId: string, input: UpdateFloorInput): Promise<Floor> {
  return mutate<Floor>(`/buildings/${encodeURIComponent(buildingId)}/floors/${encodeURIComponent(floorId)}`, 'PUT', input);
}

// ==========================================
// UC13 & UC14: Phòng (Room Management)
// ==========================================
export async function getRoomsByBuilding(buildingId: string): Promise<Room[]> {
  return request<Room[]>(`/buildings/${encodeURIComponent(buildingId)}/rooms`);
}

export async function createRoom(buildingId: string, input: CreateRoomInput): Promise<Room> {
  return mutate<Room>(`/buildings/${encodeURIComponent(buildingId)}/rooms`, 'POST', input);
}

export async function getRoomDetail(roomId: string, buildingId?: string): Promise<RoomDetail> {
  const path = buildingId
    ? `/buildings/${encodeURIComponent(buildingId)}/rooms/${encodeURIComponent(roomId)}`
    : `/rooms/${encodeURIComponent(roomId)}/detail`;
  return request<RoomDetail>(path);
}

export async function updateRoom(roomId: string, input: UpdateRoomInput, buildingId?: string): Promise<Room> {
  const path = buildingId
    ? `/buildings/${encodeURIComponent(buildingId)}/rooms/${encodeURIComponent(roomId)}`
    : `/rooms/${encodeURIComponent(roomId)}`;
  return mutate<Room>(path, 'PUT', input);
}

// ==========================================
// UC15: Tra cứu & Theo dõi phòng (Room Query & Tracking)
// ==========================================
export async function searchRooms(params: RoomFilterParams): Promise<RoomSearchItem[]> {
  const query = new URLSearchParams();
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
  if (params.areaId) query.set('areaId', params.areaId);
  if (params.buildingId) query.set('buildingId', params.buildingId);
  if (params.floorId) query.set('floorId', params.floorId);
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  return request<RoomSearchItem[]>(`/rooms/search${qs ? `?${qs}` : ''}`);
}

export async function getBuildingOverview(buildingId: string): Promise<BuildingOverview> {
  return request<BuildingOverview>(`/buildings/${encodeURIComponent(buildingId)}/overview`);
}

export async function getRoomHistory(roomId: string): Promise<RoomHistory> {
  return request<RoomHistory>(`/rooms/${encodeURIComponent(roomId)}/history`);
}

