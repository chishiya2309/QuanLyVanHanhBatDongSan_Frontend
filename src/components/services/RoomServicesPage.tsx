import { Fragment, useEffect, useRef } from 'react';
import { useRoomServices } from '../../hooks/useRoomServices';
import type { NavigationGuardRegistration } from '../../hooks/useServiceCatalog';
import { chargeMethods } from '../../types/serviceCatalog';
import {
  priceSourceLabels,
  roomServiceMessages as m,
  serviceSourceLabels,
  type RoomServiceItem,
  type RoomServicesRoute,
} from '../../types/roomServices';
import { formatCatalogMoney } from '../../utils/serviceCatalogValidation';
import './roomServices.css';

const money = (value: string | null) =>
  value === null ? 'Chưa thiết lập' : formatCatalogMoney(value);
export function RoomServicesForbidden({ onBack }: { onBack: () => void }) {
  return (
    <section className="rs-page">
      <h1>Cấu hình dịch vụ của phòng</h1>
      <div className="rs-notice rs-notice--error" role="alert">
        {m.forbidden}
      </div>
      <button type="button" className="rs-button" onClick={onBack}>
        Về tổng quan
      </button>
    </section>
  );
}
export function RoomServicesPage({
  route,
  onNavigate,
  onSessionExpired,
  registerGuard,
}: {
  route: RoomServicesRoute;
  onNavigate: (url: string) => void;
  onSessionExpired: () => void;
  registerGuard: NavigationGuardRegistration;
}) {
  const c = useRoomServices({ roomId: route.roomId, registerGuard, onSessionExpired });
  const opener = useRef<HTMLElement | null>(null);
  const hadDraft = useRef(false);
  const form = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (c.draft) hadDraft.current = true;
    else if (hadDraft.current && !c.saving && !c.loading) {
      if (opener.current?.isConnected) opener.current.focus();
      hadDraft.current = false;
    }
  }, [c.draft, c.saving, c.loading]);
  useEffect(() => {
    if (Object.keys(c.fields).length)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [c.fields]);

  function priceEditor(item: RoomServiceItem) {
    const draft = c.draft;
    if (draft?.kind !== 'price' || draft.item.serviceId !== item.serviceId) return null;
    const original = draft.item;
    return (
      <tr className="rs-editor-row">
        <td colSpan={7}>
          <form
            className="rs-editor"
            ref={form}
            onSubmit={(event) => {
              event.preventDefault();
              c.submit();
            }}
            aria-labelledby="rs-price-title"
            aria-busy={c.saving}
          >
            <div className="rs-editor-heading">
              <h3 id="rs-price-title">
                {original.roomPrice === null ? 'Thiết lập' : 'Cập nhật'} giá riêng: {original.name}
              </h3>
              <p>
                {original.unit} / {chargeMethods[original.method]}
              </p>
            </div>
            <dl className="rs-comparison">
              <div>
                <dt>Giá cấu hình hiện tại</dt>
                <dd>
                  {money(original.unitPrice)}
                  <span>{priceSourceLabels[original.priceSource]}</span>
                </dd>
              </div>
              <div>
                <dt>Giá riêng của phòng</dt>
                <dd>{money(original.roomPrice)}</dd>
              </div>
              <div>
                <dt>Giá tòa nhà</dt>
                <dd>{money(original.buildingPrice)}</dd>
              </div>
              <div>
                <dt>Giá danh mục</dt>
                <dd>{money(original.catalogPrice)}</dd>
              </div>
              <div>
                <dt>Giá kế thừa</dt>
                <dd>{money(original.inheritedPrice)}</dd>
              </div>
            </dl>
            {draft.reviewRequired && (
              <p className="rs-draft-warning" role="status">
                Bản nháp được giữ để đối chiếu. Hãy hủy và mở lại thao tác sau khi tải lại dữ liệu.
              </p>
            )}
            <div className="rs-field">
              <label htmlFor="rs-price">Đơn giá riêng (VND)</label>
              <input
                id="rs-price"
                autoFocus
                type="text"
                inputMode="numeric"
                value={draft.value}
                onChange={(event) => c.changePrice(event.target.value)}
                disabled={!c.canWrite || draft.reviewRequired}
                aria-invalid={Boolean(c.fields.unitPrice)}
                aria-describedby="rs-price-help"
              />
              <p id="rs-price-help" className={c.fields.unitPrice ? 'rs-field-error' : 'rs-muted'}>
                {c.fields.unitPrice ||
                  'Nhập chữ số nguyên, ví dụ 100000. Giá 0 hợp lệ; bỏ trống không xóa giá riêng.'}
              </p>
            </div>
            {c.fields.version && (
              <p className="rs-field-error" role="alert">
                {c.fields.version}
              </p>
            )}
            <div className="rs-actions">
              <button
                type="submit"
                className="rs-button rs-button--primary"
                disabled={!c.canWrite || draft.reviewRequired}
              >
                {c.saving ? 'Đang lưu…' : 'Lưu giá riêng'}
              </button>
              <button type="button" className="rs-button" onClick={c.cancel} disabled={c.saving}>
                Hủy
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }
  return (
    <section className="rs-page" aria-labelledby="rs-title">
      <button
        className="rs-back"
        type="button"
        onClick={() => onNavigate(route.returnTo)}
        disabled={c.saving}
      >
        Quay lại phòng đã chọn
      </button>
      <header className="rs-header">
        <div>
          <h1 id="rs-title">Cấu hình dịch vụ của phòng</h1>
          {c.snapshot && (
            <p className="rs-context">
              <strong>{c.snapshot.roomName}</strong>
              <span>Mã phòng: {c.snapshot.roomCode}</span>
              <span>Tòa nhà: {c.snapshot.buildingName}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          className="rs-button rs-button--primary"
          disabled={!c.canWrite}
          aria-expanded={c.draft?.kind === 'add'}
          aria-controls="rs-add"
          onClick={(event) => {
            opener.current = event.currentTarget;
            c.openAdd();
          }}
        >
          Thêm dịch vụ riêng
        </button>
      </header>
      <div className="rs-feedback" aria-live="polite" aria-atomic="true">
        {c.notice && (
          <p
            className={`rs-notice rs-notice--${c.notice.kind}`}
            role={c.notice.kind === 'error' ? 'alert' : 'status'}
          >
            {c.notice.message}
          </p>
        )}
      </div>
      {c.error && (
        <div className="rs-notice rs-notice--error" role="alert">
          <p>{c.error}</p>
          {c.trust !== 'fatal' && (
            <button
              type="button"
              className="rs-button"
              onClick={c.reload}
              disabled={c.loading || c.saving}
            >
              Tải lại danh sách
            </button>
          )}
        </div>
      )}
      {c.snapshot && c.trust !== 'fresh' && (
        <p className="rs-stale" role="status">
          {c.trust === 'saved'
            ? 'Cấu hình vừa lưu được giữ lại. Danh sách chưa được tải lại đầy đủ.'
            : 'Danh sách chưa được xác minh lại. Các thao tác ghi đang khóa.'}
        </p>
      )}
      {c.draft?.kind === 'add' && (
        <form
          id="rs-add"
          className="rs-add"
          ref={form}
          aria-labelledby="rs-add-title"
          aria-busy={c.saving || c.availableLoading}
          onSubmit={(event) => {
            event.preventDefault();
            c.submit();
          }}
        >
          <h2 id="rs-add-title">Chọn dịch vụ riêng</h2>
          <p className="rs-muted">
            Chọn từ danh mục đủ điều kiện. Giá ban đầu kế thừa từ tòa nhà hoặc danh mục.
          </p>
          {c.availableLoading ? (
            <div className="rs-skeleton rs-skeleton--field" role="status">
              Đang tải dịch vụ có thể thêm…
            </div>
          ) : c.availableError ? (
            <div className="rs-notice rs-notice--error" role="alert">
              <p>{c.availableError}</p>
              <button
                type="button"
                className="rs-button"
                onClick={() => void c.loadAvailable()}
                disabled={c.saving}
              >
                Thử lại lựa chọn
              </button>
            </div>
          ) : c.available.length === 0 ? (
            <p role="status">{m.noneAvailable}</p>
          ) : (
            <div className="rs-field">
              <label htmlFor="rs-service">Dịch vụ</label>
              <select
                id="rs-service"
                autoFocus
                value={c.draft.serviceId}
                onChange={(event) => c.choose(event.target.value)}
                disabled={!c.canWrite || c.draft.reviewRequired}
                aria-invalid={Boolean(c.fields.serviceId)}
                aria-describedby="rs-service-help"
              >
                <option value="">Chọn dịch vụ</option>
                {c.available.map((item) => (
                  <option key={item.serviceId} value={item.serviceId}>
                    {item.name} / {item.unit} / {money(item.unitPrice)}
                  </option>
                ))}
              </select>
              <p
                id="rs-service-help"
                className={c.fields.serviceId ? 'rs-field-error' : 'rs-muted'}
              >
                {c.fields.serviceId || 'Chỉ thêm dịch vụ vào phòng đang chọn.'}
              </p>
              {c.available
                .filter(
                  (item) => item.serviceId === (c.draft?.kind === 'add' ? c.draft.serviceId : ''),
                )
                .map((item) => (
                  <p key={item.serviceId}>
                    {chargeMethods[item.method]} / {priceSourceLabels[item.priceSource]}
                  </p>
                ))}
            </div>
          )}
          {c.draft.reviewRequired && (
            <p className="rs-draft-warning" role="status">
              Bản nháp được giữ để đối chiếu. Hãy hủy và mở lại thao tác sau khi tải lại dữ liệu.
            </p>
          )}
          {c.fields.version && (
            <p className="rs-field-error" role="alert">
              {c.fields.version}
            </p>
          )}
          <div className="rs-actions">
            <button
              type="submit"
              className="rs-button rs-button--primary"
              disabled={
                !c.canWrite ||
                c.draft.reviewRequired ||
                c.availableLoading ||
                Boolean(c.availableError) ||
                c.available.length === 0
              }
            >
              {c.saving ? 'Đang lưu…' : 'Lưu dịch vụ'}
            </button>
            <button type="button" className="rs-button" onClick={c.cancel} disabled={c.saving}>
              Hủy
            </button>
          </div>
        </form>
      )}
      {c.loading && (
        <div className="rs-skeleton" role="status" aria-label="Đang tải cấu hình dịch vụ">
          <p>Đang tải cấu hình dịch vụ…</p>
          <div />
          <div />
          <div />
        </div>
      )}
      {c.snapshot && (
        <>
          {c.snapshot.services.length === 0 ? (
            <div className="rs-empty">
              <h2>{m.empty}</h2>
              <p>Thêm dịch vụ riêng để cấu hình cho phòng này.</p>
            </div>
          ) : (
            <div className="rs-table-region">
              <table className="rs-table">
                <caption className="rs-sr-only">
                  Dịch vụ của phòng {c.snapshot.roomCode}; nguồn dịch vụ và nguồn giá độc lập.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Dịch vụ</th>
                    <th scope="col">Đơn vị / cách tính</th>
                    <th scope="col">Nguồn dịch vụ</th>
                    <th scope="col">Trạng thái áp dụng</th>
                    <th scope="col">Đơn giá (VND)</th>
                    <th scope="col">Nguồn đơn giá</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {c.snapshot.services.map((item) => (
                    <Fragment key={item.serviceId}>
                      <tr data-service-id={item.serviceId}>
                        <th scope="row">{item.name}</th>
                        <td data-label="Đơn vị / cách tính">
                          {item.unit}
                          <span className="rs-cell-note">{chargeMethods[item.method]}</span>
                        </td>
                        <td data-label="Nguồn dịch vụ">
                          <span
                            className={`rs-source ${item.serviceSource === 'ROOM_PRIVATE' ? 'rs-source--private' : ''}`}
                          >
                            {serviceSourceLabels[item.serviceSource]}
                          </span>
                        </td>
                        <td data-label="Trạng thái áp dụng">
                          {item.serviceSource === 'ROOM_PRIVATE' ? (
                            <label className="rs-toggle">
                              <input
                                type="checkbox"
                                role="switch"
                                aria-label={`Áp dụng ${item.name}`}
                                checked={item.enabled}
                                disabled={!c.canWrite || Boolean(c.draft)}
                                onChange={() => c.toggle(item)}
                              />
                              <span>
                                {c.saving && c.pendingId === item.serviceId
                                  ? 'Đang lưu…'
                                  : item.enabled
                                    ? 'Đang bật'
                                    : 'Đang tắt'}
                              </span>
                            </label>
                          ) : (
                            <>
                              <span>{item.enabled ? 'Đang bật' : 'Đang tắt'}</span>
                              <span className="rs-cell-note">Quản lý tại tòa nhà</span>
                            </>
                          )}
                        </td>
                        <td data-label="Đơn giá (VND)" className="rs-money">
                          {money(item.unitPrice)}
                        </td>
                        <td data-label="Nguồn đơn giá">{priceSourceLabels[item.priceSource]}</td>
                        <td data-label="Thao tác">
                          <button
                            type="button"
                            className="rs-button rs-button--text"
                            disabled={!c.canWrite}
                            aria-expanded={
                              c.draft?.kind === 'price' && c.draft.item.serviceId === item.serviceId
                            }
                            aria-label={`${item.roomPrice === null ? 'Thiết lập' : 'Cập nhật'} giá riêng ${item.name}`}
                            onClick={(event) => {
                              opener.current = event.currentTarget;
                              c.openPrice(item);
                            }}
                          >
                            {item.roomPrice === null ? 'Thiết lập giá riêng' : 'Cập nhật giá riêng'}
                          </button>
                        </td>
                      </tr>
                      {priceEditor(item)}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="rs-footnote">
            Giá riêng của phòng được ưu tiên trước giá tòa nhà và giá danh mục. {m.cycle}
          </p>
        </>
      )}
    </section>
  );
}
