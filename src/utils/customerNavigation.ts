import type { CustomerRoute } from '../types/customer';
import type { CustomerAccountAction } from '../types/customerAccount';

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

export function parseCustomerRoute(pathname: string, search: string): CustomerRoute | null {
  const match = /^\/customers(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return null;

  const params = new URLSearchParams(search);
  const rawCustomerId = match[1];
  const hasCustomerId = Boolean(rawCustomerId);
  const validCustomerId = hasCustomerId ? isUuid(rawCustomerId) : true;

  const pageText = params.get('page') || '0';
  const page = /^\d+$/.test(pageText) && Number.isSafeInteger(Number(pageText)) && Number(pageText) <= 2147483647
    ? Number(pageText)
    : 0;

  const sizeText = params.get('size') || '20';
  const size = /^(10|20|50|100)$/.test(sizeText) ? Number(sizeText) : 20;

  const q = (params.get('q') || '').trim();

  const rawAction = params.get('action');
  const action = rawAction === 'create' || (hasCustomerId && rawAction === 'edit') ? rawAction : null;

  const rawVehicleAction = params.get('vehicleAction');
  const rawVehicleId = params.get('vehicleId');
  const validVehicleId = rawVehicleId ? isUuid(rawVehicleId) : false;

  let vehicleAction: 'create' | 'edit' | null = null;
  let vehicleId: string | null = null;

  if (hasCustomerId && rawVehicleAction === 'create') {
    vehicleAction = 'create';
  } else if (hasCustomerId && rawVehicleAction === 'edit' && validVehicleId) {
    vehicleAction = 'edit';
    vehicleId = rawVehicleId;
  }

  const rawAccountAction = params.get('accountAction');
  const accountAction: CustomerAccountAction = hasCustomerId &&
    (rawAccountAction === 'provision' || rawAccountAction === 'lock' || rawAccountAction === 'unlock') ? rawAccountAction : null;
  const modalCount = [params.has('action'), params.has('vehicleAction'), params.has('accountAction')].filter(Boolean).length;
  const invalid =
    !validCustomerId ||
    (params.has('action') && !action) ||
    (params.has('vehicleAction') && !vehicleAction) ||
    (rawVehicleAction === 'edit' && !validVehicleId) ||
    q.length > 200 ||
    params.getAll('q').length > 1 ||
    params.getAll('page').length > 1 ||
    params.getAll('size').length > 1 ||
    params.getAll('action').length > 1 ||
    params.getAll('vehicleAction').length > 1 ||
    params.getAll('vehicleId').length > 1 ||
    params.getAll('accountAction').length > 1 ||
    (params.has('accountAction') && !accountAction) || modalCount > 1;

  return {
    view: hasCustomerId && validCustomerId ? 'detail' : 'list',
    customerId: hasCustomerId && validCustomerId ? rawCustomerId : null,
    action,
    vehicleAction,
    accountAction,
    vehicleId,
    page,
    size,
    q,
    invalid,
  };
}

export function customerUrl(
  route: Pick<CustomerRoute, 'q' | 'page' | 'size'>,
  options?: {
    customerId?: string | null;
    action?: 'create' | 'edit' | null;
    vehicleAction?: 'create' | 'edit' | null;
    vehicleId?: string | null;
    accountAction?: CustomerAccountAction;
  }
): string {
  const customerId = options?.customerId;
  const pathname = customerId ? `/customers/${encodeURIComponent(customerId)}` : '/customers';
  const params = new URLSearchParams();

  if (route.q && route.q.trim()) {
    params.set('q', route.q.trim());
  }

  if (route.page > 0) {
    params.set('page', String(route.page));
  }

  if (route.size !== 20) {
    params.set('size', String(route.size));
  }

  if (options?.action) {
    params.set('action', options.action);
  }

  if (options?.vehicleAction) {
    params.set('vehicleAction', options.vehicleAction);
    if (options.vehicleAction === 'edit' && options.vehicleId) {
      params.set('vehicleId', options.vehicleId);
    }
  }

  if (customerId && options?.accountAction) params.set('accountAction', options.accountAction);

  const qs = params.toString();
  return pathname + (qs ? '?' + qs : '');
}
