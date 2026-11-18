import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthApiError } from '../../services/authErrors';
import { getRentalProfile } from '../../services/rentalProfileApi';
import { rentalProfileMessages as messages, rentalProfileTitle, type RentalProfile, type RentalProfileData, type RentedRoom } from '../../types/rentalProfile';
import { profileBirthDate, profileIdentityType } from '../../utils/profilePresentation';
import './rentalProfile.css';

const missing = 'Chưa cập nhật';
const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 });
const roomFields = [
  ['Mã phòng', (room: RentedRoom) => room.code],
  ['Tên phòng', (room: RentedRoom) => room.name],
  ['Diện tích', (room: RentedRoom) => room.area === null ? missing : `${areaFormat.format(room.area)} m²`],
  ['Tầng', (room: RentedRoom) => room.floor],
  ['Tòa nhà', (room: RentedRoom) => room.buildingName],
  ['Địa chỉ tòa nhà', (room: RentedRoom) => room.buildingAddress],
] as const;

function ProfileFields({ profile }: { profile: RentalProfile }) {
  const fields = [
    ['Họ tên', profile.fullName], ['Số điện thoại', profile.phone], ['Email', profile.email],
    ['Loại giấy tờ', profileIdentityType(profile.identityType)], ['Số giấy tờ', profile.identityNo],
    ['Ngày sinh', profileBirthDate(profile.birthDate)], ['Địa chỉ', profile.address],
  ];
  return <dl className="rp-fields">
    {fields.map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd>{value?.trim() || missing}</dd>
    </div>)}
  </dl>;
}

function Rooms({ rooms }: { rooms: RentedRoom[] }) {
  return <>
    <table className="rp-table" aria-labelledby="rp-rooms-title">
      <thead><tr>{roomFields.map(([label]) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rooms.map((room, index) => (
        <tr key={index}>{roomFields.map(([label, value]) => <td key={label}>{value(room)?.trim() || missing}</td>)}</tr>
      ))}</tbody>
    </table>
    <ul className="rp-room-list" aria-labelledby="rp-rooms-title">
      {rooms.map((room, index) => <li key={index}><dl className="rp-fields">
        {roomFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value(room)?.trim() || missing}</dd></div>)}
      </dl></li>)}
    </ul>
  </>;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready' | 'retryingRooms'; data: RentalProfileData }
  | { kind: 'forbidden' | 'notFound' | 'failure' };

function Skeleton() {
  return <div className="rp-skeleton" aria-hidden="true"><span /><span /><span /></div>;
}

function RentalProfileContent({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const pending = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    try {
      const data = await getRentalProfile(controller.signal);
      if (!controller.signal.aborted) setState({ kind: 'ready', data });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      const status = error instanceof AuthApiError ? error.status : 0;
      if (status === 401) {
        setState({ kind: 'loading' });
        onSessionExpired();
      } else {
        setState({ kind: status === 403 ? 'forbidden' : status === 404 ? 'notFound' : 'failure' });
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [onSessionExpired]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => {
      active = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, [load]);

  function retry() {
    if (pending.current) return;
    setState(state.kind === 'ready' ? { kind: 'retryingRooms', data: state.data } : { kind: 'loading' });
    void load();
  }

  if (state.kind === 'forbidden' || state.kind === 'notFound' || state.kind === 'failure') {
    return <div className="rp-notice">
      <p role="alert">{state.kind === 'forbidden' ? messages.forbidden : state.kind === 'notFound' ? messages.notFound : messages.profileFailure}</p>
      {state.kind === 'failure' && <button type="button" className="rp-retry" onClick={retry}>Thử lại</button>}
    </div>;
  }

  const data = 'data' in state ? state.data : null;
  const roomsBusy = state.kind === 'loading' || state.kind === 'retryingRooms';
  return <>
    {roomsBusy && <p className="rp-loading" role="status">{data ? 'Đang tải thông tin phòng…' : 'Đang tải hồ sơ và thông tin phòng…'}</p>}
    <section className="rp-section" aria-labelledby="rp-profile-title" aria-busy={!data}>
      <h2 id="rp-profile-title">Hồ sơ cá nhân</h2>
      {data ? <ProfileFields profile={data.profile} /> : <Skeleton />}
    </section>
    <section className="rp-section" aria-labelledby="rp-rooms-title" aria-busy={roomsBusy}>
      <h2 id="rp-rooms-title">Phòng đang thuê</h2>
      {!data && <Skeleton />}
      {data?.roomsStatus === 'LOADED' && <Rooms rooms={data.rooms} />}
      {data?.roomsStatus === 'EMPTY' && <p role="status" className="rp-empty">{messages.empty}</p>}
      {data?.roomsStatus === 'LOAD_FAILED' && <div className="rp-notice">
        {!roomsBusy && <p role="alert">{messages.roomFailure}</p>}
        <button type="button" className="rp-retry" disabled={roomsBusy} onClick={retry}>Thử lại</button>
      </div>}
      {data?.roomsStatus === 'INVALID_LINK' && <p role="alert" className="rp-notice">{messages.invalidLink}</p>}
    </section>
  </>;
}

export function RentalProfilePage({ allowed, onSessionExpired }: { allowed: boolean; onSessionExpired: () => void }) {
  return <div className="rp-page">
    <h1>{rentalProfileTitle}</h1>
    {allowed ? <RentalProfileContent onSessionExpired={onSessionExpired} />
      : <p role="alert" className="rp-notice">{messages.forbidden}</p>}
  </div>;
}
