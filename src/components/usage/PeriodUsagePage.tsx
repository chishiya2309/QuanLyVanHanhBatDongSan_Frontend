import React, { useEffect, useState } from 'react';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { getMeterBuildings, getMeterRooms, isMeterAbort } from '../../services/meterApi';
import {
  addDiscountAdjustment,
  addFeeAdjustment,
  getUsageContext,
  recordCustomFee,
  recordQuantity,
  UsageApiError
} from '../../services/usageApi';
import {
  periodUsageMessages as m,
  type PeriodUsageRoute,
  type PeriodUsageTab,
  type UsageContext
} from '../../types/periodUsage';
import { formatDate, formatVnd, periodUsageUrl } from '../../utils/periodUsageNavigation';
import './periodUsage.css';

export function UsageForbidden({ onBack }: { onBack: () => void }) {
  return (
    <section className="pu-container">
      <h1 className="pu-title">Ghi nhận số lượng, phí và giảm trừ theo kỳ</h1>
      <div role="alert" className="pu-banner pu-banner--danger">
        {m.forbidden}
      </div>
      <button type="button" className="pu-button pu-button--secondary" onClick={onBack}>
        Về trang tổng quan
      </button>
    </section>
  );
}

export function PeriodUsagePage({
  route,
  onNavigate,
  onSessionExpired
}: {
  route: PeriodUsageRoute;
  onNavigate: (url: string) => void;
  registerGuard?: NavigationGuardRegistration;
  onSessionExpired?: (message?: string) => void;
}) {
  const [buildingId, setBuildingId] = useState(route.buildingId);
  const [roomId, setRoomId] = useState(route.roomId);
  const [periodIdInput, setPeriodIdInput] = useState(route.periodId);
  const [tab, setTab] = useState<PeriodUsageTab>(route.tab);

  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);

  const [context, setContext] = useState<UsageContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  // Load buildings
  useEffect(() => {
    const controller = new AbortController();
    getMeterBuildings(controller.signal)
      .then((list) => setBuildings(list))
      .catch((e) => {
        if (!isMeterAbort(e) && e instanceof UsageApiError && e.status === 401) {
          onSessionExpired?.(m.sessionInvalid);
        }
      });
    return () => controller.abort();
  }, [onSessionExpired]);

  // Load rooms when building changes
  useEffect(() => {
    const controller = new AbortController();
    if (buildingId) {
      getMeterRooms(buildingId, controller.signal)
        .then((list) => setRooms(list))
        .catch(() => setRooms([]));
    } else {
      setRooms([]);
    }
    return () => controller.abort();
  }, [buildingId]);

  // Load usage context when periodId is provided
  const loadContext = (targetPeriodId: string) => {
    if (!targetPeriodId) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    getUsageContext(targetPeriodId, controller.signal)
      .then((data) => {
        setContext(data);
        setPeriodIdInput(data.periodId);
        setRoomId(data.roomId);
        setBuildingId(data.buildingId);
      })
      .catch((e) => {
        if (!isMeterAbort(e)) {
          if (e instanceof UsageApiError) {
            if (e.status === 401) onSessionExpired?.(m.sessionInvalid);
            else if (e.status === 404) setError(m.notFound);
            else setError(e.message || m.readFailure);
          } else {
            setError(m.readFailure);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (route.periodId) {
      loadContext(route.periodId);
    }
  }, [route.periodId]);

  const handleTabChange = (nextTab: PeriodUsageTab) => {
    setTab(nextTab);
    onNavigate(periodUsageUrl({ buildingId, roomId, periodId: periodIdInput, tab: nextTab, returnTo: route.returnTo }));
  };

  const handlePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (periodIdInput.trim()) {
      onNavigate(periodUsageUrl({ buildingId, roomId, periodId: periodIdInput.trim(), tab, returnTo: route.returnTo }));
      loadContext(periodIdInput.trim());
    }
  };

  return (
    <main className="pu-container">
      <header className="pu-header">
        <h1 className="pu-title">Ghi nhận số lượng, phí và giảm trừ theo kỳ</h1>
        {route.returnTo && <a href={route.returnTo}>Về hóa đơn nháp</a>}
        <p className="pu-subtitle">Ghi mới số lượng dịch vụ, phí thực tế riêng và khoản giảm trừ cho phòng trong kỳ tính phí.</p>
      </header>

      {/* Scope Picker */}
      <form className="pu-scope-bar" onSubmit={handlePeriodSubmit}>
        <div className="pu-field">
          <label htmlFor="pu-building" className="pu-label">Tòa nhà</label>
          <select
            id="pu-building"
            className="pu-select"
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setRoomId('');
            }}
          >
            <option value="">-- Chọn tòa nhà --</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="pu-field">
          <label htmlFor="pu-room" className="pu-label">Phòng</label>
          <select
            id="pu-room"
            className="pu-select"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={!buildingId}
          >
            <option value="">-- Chọn phòng --</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="pu-field">
          <label htmlFor="pu-period" className="pu-label">Mã kỳ tính phí (UUID)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="pu-period"
              className="pu-input"
              type="text"
              placeholder="Nhập periodId..."
              value={periodIdInput}
              onChange={(e) => setPeriodIdInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="pu-button pu-button--primary" disabled={loading || !periodIdInput.trim()}>
              {loading ? 'Đang tải...' : 'Xem kỳ'}
            </button>
          </div>
        </div>
      </form>

      {/* Error or Notice Alert */}
      {error && (
        <div role="alert" className="pu-banner pu-banner--danger">
          <span>{error}</span>
          <button type="button" className="pu-button pu-button--secondary" onClick={() => loadContext(periodIdInput)}>
            Thử lại
          </button>
        </div>
      )}

      {notice && (
        <div role="alert" className={`pu-banner pu-banner--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" className="pu-button pu-button--secondary" onClick={() => setNotice(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* Context Details & Workbench */}
      {!context && !loading && !error && (
        <div className="pu-empty-state">
          Vui lòng chọn tòa nhà, phòng và nhập ID kỳ tính phí cần ghi nhận.
        </div>
      )}

      {context && (
        <>
          {/* Period Status Banner */}
          {!context.canRecord ? (
            <div role="alert" className="pu-banner pu-banner--warning">
              <strong>{m.lockedPeriod}</strong> (Kỳ: {context.periodStatus}, Hóa đơn: {context.invoiceStatus})
            </div>
          ) : (
            <div className="pu-banner pu-banner--info">
              <span>
                <strong>{context.buildingName} - Phòng {context.roomCode}</strong> | Kỳ từ: {formatDate(context.fromDate)} đến {formatDate(context.toDate)} | Trạng thái kỳ: {context.periodStatus}
              </span>
            </div>
          )}

          {/* Workbench Tabs */}
          <nav className="pu-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'quantity'}
              className={`pu-tab ${tab === 'quantity' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('quantity')}
            >
              Dịch vụ số lượng ({context.quantityServices.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'custom'}
              className={`pu-tab ${tab === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('custom')}
            >
              Dịch vụ nhập phí ({context.customServices.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'fee'}
              className={`pu-tab ${tab === 'fee' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('fee')}
            >
              Phí phát sinh ({context.existingAdjustments.filter((a) => a.type === 'FEE').length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'discount'}
              className={`pu-tab ${tab === 'discount' ? 'is-active' : ''}`}
              onClick={() => handleTabChange('discount')}
            >
              Khoản giảm trừ ({context.existingAdjustments.filter((a) => a.type === 'DISCOUNT').length})
            </button>
          </nav>

          {/* Workbench Tab Content */}
          <div className="pu-workbench">
            {tab === 'quantity' && (
              <QuantitySection
                context={context}
                onSuccess={(msg) => {
                  setNotice({ type: 'success', text: msg });
                  loadContext(context.periodId);
                }}
                onError={(msg) => setNotice({ type: 'danger', text: msg })}
              />
            )}

            {tab === 'custom' && (
              <CustomFeeSection
                context={context}
                onSuccess={(msg) => {
                  setNotice({ type: 'success', text: msg });
                  loadContext(context.periodId);
                }}
                onError={(msg) => setNotice({ type: 'danger', text: msg })}
              />
            )}

            {tab === 'fee' && (
              <AdjustmentSection
                type="FEE"
                title="Phí phát sinh không gắn dịch vụ"
                context={context}
                onSuccess={(msg) => {
                  setNotice({ type: 'success', text: msg });
                  loadContext(context.periodId);
                }}
                onError={(msg) => setNotice({ type: 'danger', text: msg })}
              />
            )}

            {tab === 'discount' && (
              <AdjustmentSection
                type="DISCOUNT"
                title="Khoản giảm trừ (chiết khấu / hỗ trợ)"
                context={context}
                onSuccess={(msg) => {
                  setNotice({ type: 'success', text: msg });
                  loadContext(context.periodId);
                }}
                onError={(msg) => setNotice({ type: 'danger', text: msg })}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}

/** 1. Quantity Section Component */
function QuantitySection({
  context,
  onSuccess,
  onError
}: {
  context: UsageContext;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [zeroConfirmed, setZeroConfirmed] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (context.quantityServices.length === 0) {
    return <div className="pu-empty-state">Phòng này không có dịch vụ tính theo số lượng (QUANTITY) trong kỳ đã chọn.</div>;
  }

  const handleSave = async (roomServiceId: string) => {
    const val = quantities[roomServiceId];
    if (val === undefined || val.trim() === '') {
      setFieldErrors((prev) => ({ ...prev, [roomServiceId]: m.invalidQuantity }));
      return;
    }
    const num = Number(val);
    if (Number.isNaN(num) || num < 0) {
      setFieldErrors((prev) => ({ ...prev, [roomServiceId]: m.invalidQuantity }));
      return;
    }
    if (num === 0 && !zeroConfirmed[roomServiceId]) {
      setFieldErrors((prev) => ({ ...prev, [roomServiceId]: 'Vui lòng đánh dấu xác nhận số lượng là 0' }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, [roomServiceId]: '' }));
    setSubmitting(roomServiceId);

    try {
      await recordQuantity({
        periodId: context.periodId,
        roomServiceId,
        quantity: val.trim(),
        concurrencyVersion: context.concurrencyVersion
      });
      onSuccess(m.saveSuccessQuantity);
    } catch (e) {
      if (e instanceof UsageApiError) {
        if (e.status === 409) onError(e.message || m.duplicateExists);
        else onError(e.message);
      } else {
        onError('Lỗi lưu số lượng');
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="pu-table-wrapper">
      <table className="pu-table">
        <thead>
          <tr>
            <th>Dịch vụ</th>
            <th>Đơn vị tính</th>
            <th>Số lượng gợi ý</th>
            <th>Trạng thái</th>
            <th>Số lượng thực tế</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {context.quantityServices.map((svc) => (
            <tr key={svc.roomServiceId}>
              <td><strong>{svc.serviceName}</strong></td>
              <td>{svc.unit}</td>
              <td>{svc.defaultQuantity !== null ? `Gợi ý: ${svc.defaultQuantity}` : '—'}</td>
              <td>
                {svc.isRecorded ? (
                  <span className="pu-badge pu-badge--recorded">Đã ghi nhận ({svc.recordedQuantity})</span>
                ) : (
                  <span className="pu-badge pu-badge--pending">Chưa ghi</span>
                )}
              </td>
              <td>
                {svc.isRecorded ? (
                  <span>{svc.recordedQuantity}</span>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="pu-input"
                      aria-label="Số lượng sử dụng"
                      placeholder={svc.defaultQuantity ? `Gợi ý: ${svc.defaultQuantity}` : 'Nhập số lượng...'}
                      value={quantities[svc.roomServiceId] ?? ''}
                      onChange={(e) => setQuantities({ ...quantities, [svc.roomServiceId]: e.target.value })}
                      disabled={!context.canRecord || submitting === svc.roomServiceId}
                      aria-invalid={Boolean(fieldErrors[svc.roomServiceId])}
                    />
                    {quantities[svc.roomServiceId] !== undefined && quantities[svc.roomServiceId].trim() !== '' && Number(quantities[svc.roomServiceId]) === 0 && (
                      <label className="pu-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '6px' }}>
                        <input
                          type="checkbox"
                          aria-label="Xác nhận số lượng sử dụng là 0"
                          checked={Boolean(zeroConfirmed[svc.roomServiceId])}
                          onChange={(e) => setZeroConfirmed((prev) => ({ ...prev, [svc.roomServiceId]: e.target.checked }))}
                        />
                        Xác nhận số lượng sử dụng là 0
                      </label>
                    )}
                    {fieldErrors[svc.roomServiceId] && (
                      <div className="pu-field-error">{fieldErrors[svc.roomServiceId]}</div>
                    )}
                  </div>
                )}
              </td>
              <td>
                {!svc.isRecorded && (
                  <button
                    type="button"
                    className="pu-button pu-button--primary"
                    disabled={
                      !context.canRecord ||
                      submitting === svc.roomServiceId ||
                      (quantities[svc.roomServiceId] !== undefined &&
                        quantities[svc.roomServiceId].trim() !== '' &&
                        Number(quantities[svc.roomServiceId]) === 0 &&
                        !zeroConfirmed[svc.roomServiceId])
                    }
                    onClick={() => handleSave(svc.roomServiceId)}
                  >
                    {submitting === svc.roomServiceId ? 'Đang lưu...' : 'Lưu số lượng'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 2. Custom Fee Section Component */
function CustomFeeSection({
  context,
  onSuccess,
  onError
}: {
  context: UsageContext;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (context.customServices.length === 0) {
    return <div className="pu-empty-state">Phòng này không có dịch vụ nhập phí thực tế (CUSTOM) trong kỳ đã chọn.</div>;
  }

  const handleSave = async (roomServiceId: string) => {
    const val = amounts[roomServiceId];
    if (val === undefined || val.trim() === '') {
      setFieldErrors((prev) => ({ ...prev, [roomServiceId]: m.invalidAmount }));
      return;
    }
    const num = Number(val);
    if (!Number.isSafeInteger(num) || num < 0) {
      setFieldErrors((prev) => ({ ...prev, [roomServiceId]: m.invalidAmount }));
      return;
    }

    setFieldErrors((prev) => ({ ...prev, [roomServiceId]: '' }));
    setSubmitting(roomServiceId);

    try {
      await recordCustomFee({
        periodId: context.periodId,
        roomServiceId,
        amount: num,
        concurrencyVersion: context.concurrencyVersion
      });
      onSuccess(m.saveSuccessCustom);
    } catch (e) {
      if (e instanceof UsageApiError) {
        if (e.status === 409) onError(e.message || m.duplicateExists);
        else onError(e.message);
      } else {
        onError('Lỗi lưu phí dịch vụ');
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="pu-table-wrapper">
      <table className="pu-table">
        <thead>
          <tr>
            <th>Dịch vụ</th>
            <th>Đơn vị tính</th>
            <th>Trạng thái</th>
            <th>Khoản phí thực tế (VND)</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {context.customServices.map((svc) => (
            <tr key={svc.roomServiceId}>
              <td><strong>{svc.serviceName}</strong></td>
              <td>{svc.unit}</td>
              <td>
                {svc.isRecorded ? (
                  <span className="pu-badge pu-badge--recorded">Đã ghi nhận ({formatVnd(svc.recordedAmount)})</span>
                ) : (
                  <span className="pu-badge pu-badge--pending">Chưa ghi</span>
                )}
              </td>
              <td>
                {svc.isRecorded ? (
                  <span>{formatVnd(svc.recordedAmount)}</span>
                ) : (
                  <div>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="pu-input"
                      placeholder="Nhập số tiền VND..."
                      value={amounts[svc.roomServiceId] ?? ''}
                      onChange={(e) => setAmounts({ ...amounts, [svc.roomServiceId]: e.target.value })}
                      disabled={!context.canRecord || submitting === svc.roomServiceId}
                      aria-invalid={Boolean(fieldErrors[svc.roomServiceId])}
                    />
                    {fieldErrors[svc.roomServiceId] && (
                      <div className="pu-field-error">{fieldErrors[svc.roomServiceId]}</div>
                    )}
                  </div>
                )}
              </td>
              <td>
                {!svc.isRecorded && (
                  <button
                    type="button"
                    className="pu-button pu-button--primary"
                    disabled={!context.canRecord || submitting === svc.roomServiceId}
                    onClick={() => handleSave(svc.roomServiceId)}
                  >
                    {submitting === svc.roomServiceId ? 'Đang lưu...' : 'Lưu phí'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 3. Adjustment Section Component (FEE / DISCOUNT) */
function AdjustmentSection({
  type,
  title,
  context,
  onSuccess,
  onError
}: {
  type: 'FEE' | 'DISCOUNT';
  title: string;
  context: UsageContext;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const existing = context.existingAdjustments.filter((a) => a.type === type);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [descError, setDescError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (!description.trim()) {
      setDescError(m.emptyDescription);
      valid = false;
    } else {
      setDescError('');
    }

    const num = Number(amountStr);
    if (!amountStr.trim() || !Number.isSafeInteger(num) || num < 0) {
      setAmountError(m.invalidAmount);
      valid = false;
    } else {
      setAmountError('');
    }

    if (!valid) return;
    setSubmitting(true);

    try {
      if (type === 'FEE') {
        await addFeeAdjustment({
          periodId: context.periodId,
          description: description.trim(),
          amount: num,
          concurrencyVersion: context.concurrencyVersion
        });
        onSuccess(m.saveSuccessFee);
      } else {
        await addDiscountAdjustment({
          periodId: context.periodId,
          description: description.trim(),
          amount: num,
          concurrencyVersion: context.concurrencyVersion
        });
        onSuccess(m.saveSuccessDiscount);
      }
      setDescription('');
      setAmountStr('');
    } catch (err) {
      if (err instanceof UsageApiError) {
        if (err.status === 409) onError(err.message || m.duplicateFeeSource);
        else onError(err.message);
      } else {
        onError('Lỗi thêm khoản điều chỉnh');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="pu-section-header">
        <h2 className="pu-section-title">{title}</h2>
      </div>

      {existing.length === 0 ? (
        <div className="pu-empty-state">Chưa có khoản {type === 'FEE' ? 'phí phát sinh' : 'giảm trừ'} nào trong kỳ này.</div>
      ) : (
        <div className="pu-table-wrapper">
          <table className="pu-table">
            <thead>
              <tr>
                <th>Nội dung</th>
                <th>Số tiền</th>
                <th>Thời điểm ghi nhận</th>
              </tr>
            </thead>
            <tbody>
              {existing.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.description}</strong></td>
                  <td>{type === 'DISCOUNT' ? `- ${formatVnd(item.amount)}` : `+ ${formatVnd(item.amount)}`}</td>
                  <td>{new Date(item.recordedAt).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Adjustment Form */}
      {context.canRecord && (
        <form className="pu-form-card" onSubmit={handleSubmit}>
          <h3 className="pu-form-title">Thêm {type === 'FEE' ? 'phí phát sinh' : 'khoản giảm trừ'} mới</h3>
          <div className="pu-form-grid">
            <div className="pu-field">
              <label htmlFor={`pu-desc-${type}`} className="pu-label">Nội dung / Diễn giải</label>
              <input
                id={`pu-desc-${type}`}
                type="text"
                className="pu-input"
                placeholder={type === 'FEE' ? 'Ví dụ: Phí dọn dẹp cồng kềnh' : 'Ví dụ: Hỗ trợ tiền nước bảo trì'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(descError)}
              />
              {descError && <div className="pu-field-error">{descError}</div>}
            </div>

            <div className="pu-field">
              <label htmlFor={`pu-amt-${type}`} className="pu-label">Số tiền VND (độ lớn không âm)</label>
              <input
                id={`pu-amt-${type}`}
                type="number"
                step="1"
                min="0"
                className="pu-input"
                placeholder="Ví dụ: 100000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(amountError)}
              />
              {amountError && <div className="pu-field-error">{amountError}</div>}
            </div>
          </div>

          <div className="pu-form-actions">
            <button
              type="button"
              className="pu-button pu-button--secondary"
              disabled={submitting || (!description && !amountStr)}
              onClick={() => {
                setDescription('');
                setAmountStr('');
                setDescError('');
                setAmountError('');
              }}
            >
              Hủy nhập
            </button>
            <button type="submit" className="pu-button pu-button--primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : type === 'FEE' ? 'Lưu phí phát sinh' : 'Lưu khoản giảm trừ'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
