import { parse } from 'lossless-json';
import type {
  CashLedgerAttachmentItem,
  CashLedgerDetail,
  CashLedgerDirection,
  CashLedgerEmptyState,
  CashLedgerEntryItem,
  CashLedgerFilterState,
  CashLedgerPageData,
  CashLedgerSummary,
  CreateManualCashPayload,
  ManualCashCategoryOption,
  ManualCashConfirmation,
  ManualCashFundingSourceOption,
  ManualCashInitData,
  StagedAttachmentItem,
} from '../types/cashLedger';
import type { FinancialLedgerFilter } from '../utils/financeNavigation';
import { appendFinancialParams } from '../utils/financeNavigation';
import { isRecord, safeInteger } from './assetCodec';
import { decodeFinanceMoney } from './financeApi';
import { authenticatedFetch } from './sessionClient';

const BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const FORBIDDEN_MESSAGE = 'Bạn không có quyền truy cập vào sổ thu chi này';

export class CashLedgerApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function invalid(): never {
  throw new Error('Dữ liệu sổ thu chi trả về không hợp lệ.');
}

const asRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : invalid());
const asText = (value: unknown): string => (typeof value === 'string' ? value : invalid());
const asOptionalText = (value: unknown): string | undefined => (value == null ? undefined : asText(value));
const asBool = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const asCount = (value: unknown): number => {
  const n = safeInteger(value);
  return n !== null && n >= 0 ? n : invalid();
};
const asList = <T>(value: unknown, decode: (item: unknown) => T): T[] =>
  Array.isArray(value) ? value.map(decode) : invalid();

function decodeDirection(value: unknown): CashLedgerDirection {
  return value === 'IN' || value === 'OUT' ? value : 'IN';
}

function decodeSummary(value: unknown): CashLedgerSummary {
  if (!isRecord(value)) {
    return { totalIncome: 0n, totalExpense: 0n, netCashFlow: 0n, estimatedProfit: 0n };
  }
  return {
    totalIncome: decodeFinanceMoney(value.totalIncome),
    totalExpense: decodeFinanceMoney(value.totalExpense),
    netCashFlow: decodeFinanceMoney(value.netCashFlow),
    estimatedProfit: decodeFinanceMoney(value.estimatedProfit),
  };
}

function decodeEntryItem(value: unknown): CashLedgerEntryItem {
  const row = asRecord(value);
  return {
    id: asText(row.id),
    sourceId: asText(row.sourceId),
    amount: decodeFinanceMoney(row.amount),
    direction: decodeDirection(row.direction),
    origin: asText(row.origin),
    category: asOptionalText(row.category),
    occurredAt: asText(row.occurredAt),
    recordedAt: asOptionalText(row.recordedAt),
    confirmedAt: asOptionalText(row.confirmedAt),
    confirmedBy: asOptionalText(row.confirmedBy),
    method: asOptionalText(row.method),
    areaId: asOptionalText(row.areaId),
    buildingId: asOptionalText(row.buildingId),
    roomId: asOptionalText(row.roomId),
    transferId: asOptionalText(row.transferId),
    adjustsId: asOptionalText(row.adjustsId),
    correctionKind: asOptionalText(row.correctionKind),
    depositId: asOptionalText(row.depositId),
    settlementId: asOptionalText(row.settlementId),
    paymentId: asOptionalText(row.paymentId),
    note: asOptionalText(row.note),
    adjustments: Array.isArray(row.adjustments) ? row.adjustments.map(asText) : [],
    reportDirection: asOptionalText(row.reportDirection) ?? decodeDirection(row.direction),
    reportAmount: row.reportAmount != null ? decodeFinanceMoney(row.reportAmount) : decodeFinanceMoney(row.amount),
    confirmationStatus: asOptionalText(row.confirmationStatus),
    voucherCode: asOptionalText(row.voucherCode),
    categoryName: asOptionalText(row.categoryName),
    sourceName: asOptionalText(row.sourceName),
    sourceType: asOptionalText(row.sourceType),
    scopeLabel: asOptionalText(row.scopeLabel),
    areaName: asOptionalText(row.areaName),
    buildingName: asOptionalText(row.buildingName),
    roomCode: asOptionalText(row.roomCode),
    affectsProfit: asBool(row.affectsProfit, false),
    isReversal: asBool(row.isReversal, row.correctionKind === 'REVERSAL'),
    isReversed: asBool(row.isReversed, false),
    hasAttachments: asBool(row.hasAttachments, false),
    attachmentCount: row.attachmentCount != null ? asCount(row.attachmentCount) : 0,
  };
}

export function decodeCashLedgerPage(value: unknown): CashLedgerPageData {
  const page = asRecord(value);
  const emptyStateRaw = page.emptyState;
  const emptyState: CashLedgerEmptyState | undefined =
    emptyStateRaw === 'NO_DATA' || emptyStateRaw === 'NO_MATCH' ? emptyStateRaw : undefined;

  return {
    items: asList(page.items, decodeEntryItem),
    page: asCount(page.page),
    size: asCount(page.size),
    totalElements: asCount(page.totalElements),
    ...(page.totalContribution == null ? {} : { totalContribution: decodeFinanceMoney(page.totalContribution) }),
    summary: decodeSummary(page.summary),
    emptyState,
    emptyMessage: asOptionalText(page.emptyMessage),
  };
}

function decodeAttachmentItem(value: unknown): CashLedgerAttachmentItem {
  const row = asRecord(value);
  return {
    id: asText(row.id),
    fileName: asText(row.fileName),
    contentType: asText(row.contentType),
    fileSize: asCount(row.fileSize),
    previewUrl: asText(row.previewUrl),
    downloadUrl: asText(row.downloadUrl),
  };
}

export function decodeCashLedgerDetail(value: unknown): CashLedgerDetail {
  const row = asRecord(value);
  return {
    id: asText(row.id),
    voucherCode: asText(row.voucherCode),
    occurredAt: asText(row.occurredAt),
    recordedAt: asText(row.recordedAt),
    confirmedAt: asOptionalText(row.confirmedAt),
    confirmedBy: asOptionalText(row.confirmedBy),
    direction: decodeDirection(row.direction),
    amount: decodeFinanceMoney(row.amount),
    method: asOptionalText(row.method),
    categoryCode: asOptionalText(row.categoryCode),
    categoryName: asOptionalText(row.categoryName),
    sourceId: asOptionalText(row.sourceId),
    sourceName: asOptionalText(row.sourceName),
    sourceType: asOptionalText(row.sourceType),
    scopeLabel: asOptionalText(row.scopeLabel) ?? 'Chi phí chung',
    areaId: asOptionalText(row.areaId),
    areaName: asOptionalText(row.areaName),
    buildingId: asOptionalText(row.buildingId),
    buildingName: asOptionalText(row.buildingName),
    roomId: asOptionalText(row.roomId),
    roomCode: asOptionalText(row.roomCode),
    affectsProfit: asBool(row.affectsProfit, false),
    origin: asText(row.origin),
    note: asOptionalText(row.note),
    profitWarning: asOptionalText(row.profitWarning),
    invoiceId: asOptionalText(row.invoiceId),
    invoiceNumber: asOptionalText(row.invoiceNumber),
    depositId: asOptionalText(row.depositId),
    settlementId: asOptionalText(row.settlementId),
    isReversal: asBool(row.isReversal, false),
    isReversed: asBool(row.isReversed, false),
    reversalReason: asOptionalText(row.reversalReason),
    originalEntryId: asOptionalText(row.originalEntryId),
    reversalEntryId: asOptionalText(row.reversalEntryId),
    transferId: asOptionalText(row.transferId),
    fromSourceId: asOptionalText(row.fromSourceId),
    fromSourceName: asOptionalText(row.fromSourceName),
    toSourceId: asOptionalText(row.toSourceId),
    toSourceName: asOptionalText(row.toSourceName),
    attachments: Array.isArray(row.attachments) ? row.attachments.map(decodeAttachmentItem) : [],
  };
}

async function requestJson<T>(url: string, decode: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(url, {
    signal,
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const serverMessage = isRecord(body) && typeof body.message === 'string' ? body.message : '';
    if (response.status === 403) {
      throw new CashLedgerApiError(403, serverMessage || FORBIDDEN_MESSAGE);
    }
    throw new CashLedgerApiError(response.status, serverMessage || 'Không thể tải dữ liệu sổ thu chi.');
  }
  const parsed = asRecord(parse(await response.text()));
  if (asCount(parsed.status) !== 200) invalid();
  return decode(parsed.data);
}

export function buildCashLedgerParams(
  filter: CashLedgerFilterState,
  page: number,
  size: number,
  financial?: FinancialLedgerFilter,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.fromDate) params.set('fromDate', filter.fromDate);
  if (filter.toDate) params.set('toDate', filter.toDate);
  if (filter.direction) params.set('direction', filter.direction);
  for (const code of filter.categoryCodes) {
    params.append('categoryCodes', code);
  }
  if (filter.sourceId) params.set('sourceId', filter.sourceId);
  if (filter.scopeType === 'COMMON_EXPENSE') {
    params.set('scopeType', 'COMMON_EXPENSE');
  } else {
    if (filter.areaId) params.set('areaId', filter.areaId);
    if (filter.buildingId) params.set('buildingId', filter.buildingId);
    if (filter.roomId) params.set('roomId', filter.roomId);
  }
  if (filter.origin) params.set('origin', filter.origin);
  if (filter.affectsProfit !== undefined) params.set('affectsProfit', String(filter.affectsProfit));
  if (filter.entryId) params.set('entryId', filter.entryId);
  if (filter.dimension) params.set('dimension', filter.dimension);
  if (filter.groupKey) params.set('groupKey', filter.groupKey);
  appendFinancialParams(params, financial);
  params.set('page', String(page));
  params.set('size', String(size));
  return params;
}

export function fetchCashLedger(
  filter: CashLedgerFilterState,
  page: number,
  size: number,
  financial?: FinancialLedgerFilter,
  signal?: AbortSignal,
): Promise<CashLedgerPageData> {
  const params = buildCashLedgerParams(filter, page, size, financial);
  return requestJson(`${BASE_URL}/cash-ledger?${params.toString()}`, decodeCashLedgerPage, signal);
}

export function fetchCashLedgerDetail(entryId: string, signal?: AbortSignal): Promise<CashLedgerDetail> {
  return requestJson(`${BASE_URL}/cash-ledger/${encodeURIComponent(entryId)}`, decodeCashLedgerDetail, signal);
}

export async function fetchAttachmentBlob(
  entryId: string,
  attachmentId: string,
  inline: boolean,
  signal?: AbortSignal,
): Promise<{ blob: Blob; objectUrl: string }> {
  const url = `${BASE_URL}/cash-ledger/${encodeURIComponent(entryId)}/attachments/${encodeURIComponent(attachmentId)}/download?inline=${inline}`;
  const response = await authenticatedFetch(url, {
    signal,
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const serverMessage = isRecord(body) && typeof body.message === 'string' ? body.message : '';
    if (response.status === 403) {
      throw new CashLedgerApiError(403, serverMessage || FORBIDDEN_MESSAGE);
    }
    throw new CashLedgerApiError(response.status, serverMessage || 'Không thể tải tệp chứng từ.');
  }
  const blob = await response.blob();
  return { blob, objectUrl: URL.createObjectURL(blob) };
}

function decodeManualCategory(value: unknown): ManualCashCategoryOption {
  const row = asRecord(value);
  return {
    code: asText(row.code),
    name: asText(row.name),
    direction: decodeDirection(row.direction),
    affectsProfit: asBool(row.affectsProfit),
  };
}

function decodeManualFundingSource(value: unknown): ManualCashFundingSourceOption {
  const row = asRecord(value);
  const type = row.type === 'BANK' ? 'BANK' : 'CASH';
  return {
    id: asText(row.id),
    name: asText(row.name),
    type,
    availableBalance: decodeFinanceMoney(row.availableBalance),
  };
}

function decodeManualCashInit(value: unknown): ManualCashInitData {
  const row = asRecord(value);
  return {
    idempotencyKey: asText(row.idempotencyKey),
    categories: asList(row.categories, decodeManualCategory),
    fundingSources: asList(row.fundingSources, decodeManualFundingSource),
  };
}

function decodeStagedAttachment(value: unknown): StagedAttachmentItem {
  const row = asRecord(value);
  return {
    tempId: asText(row.tempId),
    fileName: asText(row.fileName),
    contentType: asText(row.contentType),
    fileSize: asCount(row.fileSize),
    previewUrl: asText(row.previewUrl),
  };
}

function decodeManualCashConfirmation(value: unknown): ManualCashConfirmation {
  const row = asRecord(value);
  return {
    entryId: asText(row.entryId),
    direction: decodeDirection(row.direction),
    amount: decodeFinanceMoney(row.amount),
    affectsProfit: asBool(row.affectsProfit),
    resultingSourceBalance: decodeFinanceMoney(row.resultingSourceBalance),
    attachmentCount: asCount(row.attachmentCount),
    reversalHint: asText(row.reversalHint),
  };
}

async function parseErrorResponse(response: Response, fallbackMessage: string): Promise<CashLedgerApiError> {
  const body: unknown = await response.json().catch(() => null);
  const serverMessage = isRecord(body) && typeof body.message === 'string' ? body.message : '';
  const serverCode = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
  if (response.status === 403) {
    return new CashLedgerApiError(403, serverMessage || FORBIDDEN_MESSAGE, serverCode);
  }
  return new CashLedgerApiError(response.status, serverMessage || fallbackMessage, serverCode);
}

export function fetchManualCashInit(signal?: AbortSignal): Promise<ManualCashInitData> {
  return requestJson(`${BASE_URL}/cash-ledger/manual/init`, decodeManualCashInit, signal);
}

export async function stageManualAttachments(files: File[], signal?: AbortSignal): Promise<StagedAttachmentItem[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const response = await authenticatedFetch(`${BASE_URL}/cash-ledger/manual/attachments`, {
    method: 'POST',
    signal,
    credentials: 'include',
    cache: 'no-store',
    body: formData,
  });
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Không thể tải lên tệp chứng từ.');
  }
  const parsed = asRecord(parse(await response.text()));
  if (asCount(parsed.status) !== 200) invalid();
  return asList(parsed.data, decodeStagedAttachment);
}

export async function fetchStagedAttachmentPreviewUrl(tempId: string, signal?: AbortSignal): Promise<string> {
  const response = await authenticatedFetch(
    `${BASE_URL}/cash-ledger/manual/attachments/${encodeURIComponent(tempId)}/preview`,
    {
      signal,
      credentials: 'include',
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Không thể tải xem trước chứng từ.');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function discardStagedAttachments(tempIds: string[]): Promise<void> {
  if (tempIds.length === 0) return;
  const response = await authenticatedFetch(`${BASE_URL}/cash-ledger/manual/attachments`, {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tempIds),
    keepalive: true,
  });
  if (!response.ok && response.status !== 404) {
    throw await parseErrorResponse(response, 'Không thể dọn dẹp chứng từ tạm.');
  }
}

export async function createManualCashEntry(
  idempotencyKey: string,
  payload: CreateManualCashPayload,
  signal?: AbortSignal,
): Promise<ManualCashConfirmation> {
  const response = await authenticatedFetch(`${BASE_URL}/cash-ledger/manual`, {
    method: 'POST',
    signal,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await parseErrorResponse(response, 'Không thể lưu giao dịch thu chi thủ công.');
  }
  const parsed = asRecord(parse(await response.text()));
  if (asCount(parsed.status) !== 200) invalid();
  return decodeManualCashConfirmation(parsed.data);
}
