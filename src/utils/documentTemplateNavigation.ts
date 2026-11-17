import type { TemplateType } from '../types/documentTemplate';

export interface DocumentTemplateRoute {
  type?: TemplateType;
  active?: boolean;
  keyword?: string;
  detailId?: string;
}

export function parseDocumentTemplateRoute(pathname: string, search: string): DocumentTemplateRoute | null {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/document-templates' && normalizedPath !== '/templates') {
    return null;
  }

  const params = new URLSearchParams(search);
  const typeParam = params.get('type')?.toUpperCase();
  const activeParam = params.get('active');
  const keyword = params.get('keyword') || undefined;
  const detailId = params.get('detail') || undefined;

  const validTypes: TemplateType[] = [
    'DEPOSIT_CONTRACT',
    'RENTAL_CONTRACT',
    'HANDOVER',
    'INVOICE',
    'RECEIPT',
    'DISBURSEMENT',
  ];

  let type: TemplateType | undefined = undefined;
  if (typeParam && validTypes.includes(typeParam as TemplateType)) {
    type = typeParam as TemplateType;
  }

  let active: boolean | undefined = undefined;
  if (activeParam === 'true') active = true;
  else if (activeParam === 'false') active = false;

  return {
    type,
    active,
    keyword,
    detailId,
  };
}

export function buildDocumentTemplateUrl(route: DocumentTemplateRoute): string {
  const params = new URLSearchParams();
  if (route.type) params.set('type', route.type);
  if (route.active !== undefined) params.set('active', String(route.active));
  if (route.keyword) params.set('keyword', route.keyword);
  if (route.detailId) params.set('detail', route.detailId);

  const query = params.toString();
  return `/document-templates${query ? `?${query}` : ''}`;
}
