import type { RentalContractRoute, RentalStatus } from '../types/rentalContract';

export function parseRentalContractRoute(pathname: string, search: string): RentalContractRoute | null {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/rental-contracts') {
    return null;
  }

  const params = new URLSearchParams(search);
  const create = params.get('create') === 'true';
  const detailId = params.get('detail') || undefined;
  const editId = params.get('edit') || undefined;
  const keyword = params.get('keyword') || undefined;
  const statusParam = params.get('status')?.toUpperCase();
  const pageParam = params.get('page');

  let status: RentalStatus | undefined = undefined;
  if (statusParam === 'DRAFT' || statusParam === 'ACTIVE' || statusParam === 'TERMINATED') {
    status = statusParam;
  }

  let page: number | undefined = undefined;
  if (pageParam && !isNaN(Number(pageParam))) {
    page = Math.max(0, parseInt(pageParam, 10));
  }

  return {
    create,
    detailId,
    editId,
    keyword,
    status,
    page,
  };
}

export function buildRentalContractUrl(route: RentalContractRoute): string {
  const params = new URLSearchParams();
  if (route.create) params.set('create', 'true');
  if (route.detailId) params.set('detail', route.detailId);
  if (route.editId) params.set('edit', route.editId);
  if (route.keyword) params.set('keyword', route.keyword);
  if (route.status) params.set('status', route.status);
  if (route.page && route.page > 0) params.set('page', String(route.page));

  const query = params.toString();
  return `/rental-contracts${query ? `?${query}` : ''}`;
}

