import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthApiError } from '../services/authErrors';
import {
  CashLedgerApiError,
  createManualCashEntry,
  discardStagedAttachments,
  fetchManualCashInit,
  fetchStagedAttachmentPreviewUrl,
  stageManualAttachments,
} from '../services/cashLedgerApi';
import { getAreas, getBuildings, getRoomsByBuilding } from '../services/propertiesApi';
import type {
  CashLedgerDirection,
  ManualCashCategoryOption,
  ManualCashConfirmation,
  ManualCashFundingSourceOption,
  ManualPaymentMethod,
  StagedAttachmentItem,
} from '../types/cashLedger';
import type { Area, Building, Room } from '../types/properties';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']);

export interface ManualCashFieldErrors {
  amount?: string;
  occurredAt?: string;
  category?: string;
  sourceId?: string;
  method?: string;
  attachments?: string;
}

export interface StagedAttachmentView extends StagedAttachmentItem {
  objectUrl?: string;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function compatibleMethodsForType(type?: 'CASH' | 'BANK'): ManualPaymentMethod[] {
  if (type === 'BANK') return ['BANK_TRANSFER', 'PAYOS'];
  return ['CASH'];
}

export function useManualCashForm(
  open: boolean,
  onClose: () => void,
  onSuccess: (confirmation: ManualCashConfirmation) => void,
  onSessionExpired: (message?: string) => void,
) {
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [allCategories, setAllCategories] = useState<ManualCashCategoryOption[]>([]);
  const [fundingSources, setFundingSources] = useState<ManualCashFundingSourceOption[]>([]);

  const [areas, setAreas] = useState<Area[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [direction, setDirectionState] = useState<CashLedgerDirection>('OUT');
  const [category, setCategory] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [sourceId, setSourceIdState] = useState('');
  const [method, setMethod] = useState<ManualPaymentMethod>('CASH');
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [areaId, setAreaIdState] = useState('');
  const [buildingId, setBuildingIdState] = useState('');
  const [roomId, setRoomId] = useState('');
  const [note, setNote] = useState('');

  const [attachments, setAttachments] = useState<StagedAttachmentView[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [overdraftWarning, setOverdraftWarning] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ManualCashFieldErrors>({});

  const attachmentsRef = useRef<StagedAttachmentView[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const revokeAllObjectUrls = useCallback((items: StagedAttachmentView[]) => {
    for (const item of items) {
      if (item.objectUrl) {
        URL.revokeObjectURL(item.objectUrl);
      }
    }
  }, []);

  const resetFormState = useCallback(() => {
    setDirectionState('OUT');
    setCategory('');
    setAmountInput('');
    setSourceIdState('');
    setMethod('CASH');
    setOccurredAt(toLocalDateTimeInput(new Date()));
    setAreaIdState('');
    setBuildingIdState('');
    setRoomId('');
    setNote('');
    setBuildings([]);
    setRooms([]);
    setFieldErrors({});
    setSubmitError(null);
    setOverdraftWarning(null);
    setInitError(null);
  }, []);

  // Initialize form options when drawer opens
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;

    async function load() {
      setInitLoading(true);
      setInitError(null);
      setSubmitError(null);
      setOverdraftWarning(null);
      setFieldErrors({});
      setOccurredAt(toLocalDateTimeInput(new Date()));

      try {
        const [initData, areaList] = await Promise.all([
          fetchManualCashInit(controller.signal),
          getAreas().catch(() => [] as Area[]),
        ]);
        if (!active) return;

        setIdempotencyKey(initData.idempotencyKey);
        setAllCategories(initData.categories);
        setFundingSources(initData.fundingSources);
        setAreas(areaList);

        const defaultCat = initData.categories.find((c) => c.direction === 'OUT');
        setCategory(defaultCat?.code ?? '');

        const defaultSource = initData.fundingSources[0];
        if (defaultSource) {
          setSourceIdState(defaultSource.id);
          setMethod(compatibleMethodsForType(defaultSource.type)[0]);
        } else {
          setSourceIdState('');
        }
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        if (err instanceof AuthApiError) {
          onSessionExpired(err.message);
          return;
        }
        setInitError(err instanceof Error ? err.message : 'Không thể khởi tạo biểu mẫu thu chi.');
      } finally {
        if (active) setInitLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, onSessionExpired]);

  // Load buildings when area changes
  useEffect(() => {
    if (!open || !areaId) {
      return;
    }
    let active = true;
    getBuildings()
      .then((list) => {
        if (active) setBuildings(list.filter((b) => b.areaId === areaId));
      })
      .catch(() => {
        if (active) setBuildings([]);
      });
    return () => {
      active = false;
    };
  }, [open, areaId]);

  // Load rooms when building changes
  useEffect(() => {
    if (!open || !buildingId) {
      return;
    }
    let active = true;
    getRoomsByBuilding(buildingId)
      .then((list) => {
        if (active) setRooms(list);
      })
      .catch(() => {
        if (active) setRooms([]);
      });
    return () => {
      active = false;
    };
  }, [open, buildingId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      revokeAllObjectUrls(attachmentsRef.current);
    };
  }, [revokeAllObjectUrls]);

  const filteredCategories = useMemo(
    () => allCategories.filter((c) => c.direction === direction),
    [allCategories, direction],
  );

  const selectedCategory = useMemo(
    () => filteredCategories.find((c) => c.code === category) ?? null,
    [filteredCategories, category],
  );

  const selectedSource = useMemo(
    () => fundingSources.find((s) => s.id === sourceId) ?? null,
    [fundingSources, sourceId],
  );

  const compatibleMethods = useMemo(
    () => compatibleMethodsForType(selectedSource?.type),
    [selectedSource],
  );

  const setDirection = useCallback(
    (nextDir: CashLedgerDirection) => {
      setDirectionState(nextDir);
      const matching = allCategories.filter((c) => c.direction === nextDir);
      setCategory((prev) => (matching.some((c) => c.code === prev) ? prev : (matching[0]?.code ?? '')));
      setFieldErrors((prev) => ({ ...prev, category: undefined }));
      setOverdraftWarning(null);
    },
    [allCategories],
  );

  const setSourceId = useCallback(
    (nextSourceId: string) => {
      setSourceIdState(nextSourceId);
      const found = fundingSources.find((s) => s.id === nextSourceId);
      const methods = compatibleMethodsForType(found?.type);
      setMethod((prev) => (methods.includes(prev) ? prev : methods[0]));
      setFieldErrors((prev) => ({ ...prev, sourceId: undefined, method: undefined }));
      setOverdraftWarning(null);
    },
    [fundingSources],
  );

  const setAreaId = useCallback((nextAreaId: string) => {
    setAreaIdState(nextAreaId);
    setBuildingIdState('');
    setRoomId('');
  }, []);

  const setBuildingId = useCallback((nextBuildingId: string) => {
    setBuildingIdState(nextBuildingId);
    setRoomId('');
  }, []);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      for (const file of files) {
        const mime = file.type.toLowerCase();
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const validExt = ['jpg', 'jpeg', 'png', 'pdf'].includes(ext);
        if (!ALLOWED_MIME_TYPES.has(mime) && !validExt) {
          setFieldErrors((prev) => ({
            ...prev,
            attachments: 'Định dạng tệp chứng từ không được hỗ trợ. Chỉ chấp nhận JPEG, PNG, PDF.',
          }));
          return;
        }
        if (file.size <= 0 || file.size >= MAX_FILE_SIZE_BYTES) {
          setFieldErrors((prev) => ({
            ...prev,
            attachments: 'Dung lượng mỗi tệp chứng từ phải lớn hơn 0 và nhỏ hơn 10 MB.',
          }));
          return;
        }
      }

      setFieldErrors((prev) => ({ ...prev, attachments: undefined }));
      setUploadingFiles(true);
      try {
        const staged = await stageManualAttachments(files);
        const withPreviews = await Promise.all(
          staged.map(async (item): Promise<StagedAttachmentView> => {
            if (!item.contentType.startsWith('image/')) {
              return item;
            }
            try {
              const objectUrl = await fetchStagedAttachmentPreviewUrl(item.tempId);
              return { ...item, objectUrl };
            } catch {
              return item;
            }
          }),
        );
        setAttachments((prev) => [...prev, ...withPreviews]);
      } catch (err) {
        if (err instanceof AuthApiError) {
          onSessionExpired(err.message);
          return;
        }
        setFieldErrors((prev) => ({
          ...prev,
          attachments: err instanceof Error ? err.message : 'Không thể tải lên chứng từ.',
        }));
      } finally {
        setUploadingFiles(false);
      }
    },
    [onSessionExpired],
  );

  const removeAttachment = useCallback((tempId: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.tempId === tempId);
      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
      }
      return prev.filter((a) => a.tempId !== tempId);
    });
    void discardStagedAttachments([tempId]).catch(() => undefined);
  }, []);

  const cancelAndClose = useCallback(() => {
    const current = attachmentsRef.current;
    if (current.length > 0) {
      const ids = current.map((a) => a.tempId);
      revokeAllObjectUrls(current);
      setAttachments([]);
      void discardStagedAttachments(ids).catch(() => undefined);
    }
    resetFormState();
    onClose();
  }, [onClose, resetFormState, revokeAllObjectUrls]);

  const submit = useCallback(
    async (confirmOverdraft = false) => {
      if (submitting || uploadingFiles) return;

      const errors: ManualCashFieldErrors = {};
      const parsedAmount = Number(amountInput.replaceAll(',', '').trim());
      if (!amountInput.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        errors.amount = 'Số tiền giao dịch phải lớn hơn 0 VND';
      }
      if (!category) {
        errors.category = 'Vui lòng chọn danh mục thu chi.';
      }
      if (!sourceId) {
        errors.sourceId = 'Vui lòng chọn nguồn tiền thanh toán.';
      }
      const occurredDate = occurredAt ? new Date(occurredAt) : null;
      if (!occurredDate || Number.isNaN(occurredDate.getTime())) {
        errors.occurredAt = 'Vui lòng chọn ngày giờ phát sinh hợp lệ.';
      } else if (occurredDate.getTime() > Date.now() + 60_000) {
        errors.occurredAt = 'Ngày phát sinh giao dịch không được vượt quá thời điểm hiện tại.';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      setFieldErrors({});
      setSubmitError(null);
      setSubmitting(true);

      try {
        const confirmation = await createManualCashEntry(idempotencyKey, {
          sourceId,
          amount: Math.round(parsedAmount),
          method,
          occurredAt: occurredDate!.toISOString(),
          category,
          direction,
          areaId: areaId || undefined,
          buildingId: buildingId || undefined,
          roomId: roomId || undefined,
          note: note.trim() || undefined,
          attachmentIds: attachmentsRef.current.map((a) => a.tempId),
          confirmOverdraft,
        });

        revokeAllObjectUrls(attachmentsRef.current);
        setAttachments([]);
        resetFormState();
        onSuccess(confirmation);
      } catch (err) {
        if (err instanceof AuthApiError) {
          onSessionExpired(err.message);
          return;
        }
        if (err instanceof CashLedgerApiError && err.status === 409 && err.code === 'OVERDRAFT_CONFIRMATION_REQUIRED') {
          setOverdraftWarning(err.message);
          return;
        }
        setSubmitError(err instanceof Error ? err.message : 'Không thể lưu giao dịch thu chi.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      amountInput,
      areaId,
      buildingId,
      category,
      direction,
      idempotencyKey,
      method,
      note,
      occurredAt,
      onSessionExpired,
      onSuccess,
      resetFormState,
      revokeAllObjectUrls,
      roomId,
      sourceId,
      submitting,
      uploadingFiles,
    ],
  );

  return {
    initLoading,
    initError,
    fundingSources,
    areas,
    buildings,
    rooms,
    direction,
    setDirection,
    filteredCategories,
    category,
    setCategory,
    selectedCategory,
    amountInput,
    setAmountInput,
    sourceId,
    setSourceId,
    selectedSource,
    method,
    setMethod,
    compatibleMethods,
    occurredAt,
    setOccurredAt,
    areaId,
    setAreaId,
    buildingId,
    setBuildingId,
    roomId,
    setRoomId,
    note,
    setNote,
    attachments,
    uploadingFiles,
    uploadFiles,
    removeAttachment,
    submitting,
    submitError,
    overdraftWarning,
    setOverdraftWarning,
    fieldErrors,
    cancelAndClose,
    submit,
  };
}
