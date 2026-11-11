import type { DepositContractRoute, DepositStatus } from '../types/depositContract';

export function parseDepositContractRoute(pathname: string, search: string): DepositContractRoute | null {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/deposit-contracts' && normalizedPath !== '/contracts') {
    return null;
  }

  const params = new URLSearchParams(search);
  const create = params.get('create') === 'true';
  const detailId = params.get('detail') || undefined;
  const editId = params.get('edit') || undefined;
  const keyword = params.get('keyword') || undefined;
  const statusParam = params.get('status')?.toUpperCase();
  const pageParam = params.get('page');

  let status: DepositStatus | undefined = undefined;
  if (statusParam === 'DRAFT' || statusParam === 'RESERVED' || statusParam === 'CONVERTED' || statusParam === 'CANCELLED') {
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

export function buildDepositContractUrl(route: DepositContractRoute): string {
  const params = new URLSearchParams();
  if (route.create) params.set('create', 'true');
  if (route.detailId) params.set('detail', route.detailId);
  if (route.editId) params.set('edit', route.editId);
  if (route.keyword) params.set('keyword', route.keyword);
  if (route.status) params.set('status', route.status);
  if (route.page && route.page > 0) params.set('page', String(route.page));

  const query = params.toString();
  return `/deposit-contracts${query ? `?${query}` : ''}`;
}

