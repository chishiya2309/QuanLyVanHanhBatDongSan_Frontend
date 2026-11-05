import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { assignAssetPlacement, transferAsset, getAsset, listAssetPlacementRooms, AssetApiError, isAssetAbort } from '../services/assetsApi';
import { assetMessages as m, type Asset, type PlacementAction } from '../types/assets';
import { isAssetId } from '../utils/assetNavigation';
import { useAssetResource } from './useAssetResource';

interface Options {
  assetId: string; action: PlacementAction;
  onFinished: (message: string, uncertain?: boolean, toList?: boolean) => void;
  onFailure: (error: unknown) => boolean;
}

export function useAssetPlacement({ assetId, action, onFinished, onFailure }: Options) {
  const callbacks = useRef({ onFinished, onFailure });
  const life = useRef({ active: true, blocked: false });
  const lock = useRef(false);
  const snapshot = useRef<Asset | null>(null);
  const [pending, setPending] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  useLayoutEffect(() => { callbacks.current = { onFinished, onFailure }; });
  useLayoutEffect(() => {
    const current = life.current; current.active = true;
    return () => { current.active = false; };
  }, []);
  const fail = useCallback((failure: unknown) => callbacks.current.onFailure(failure), []);
  const loadAsset = useCallback((signal: AbortSignal) => getAsset(assetId, signal), [assetId]);
  const loadRooms = useCallback((signal: AbortSignal) => listAssetPlacementRooms(signal), []);
  const asset = useAssetResource(assetId, loadAsset, fail, m.detailFailure);
  const rooms = useAssetResource(assetId, loadRooms, fail, m.roomListFailure);
  // This component mounts for each modal visit. Never replace a source the Host has already seen.
  useEffect(() => {
    if (asset.status !== 'ready' || !asset.data || snapshot.current || life.current.blocked) return;
    if ((action === 'assign') === (asset.data.currentPlacement !== null)) {
      life.current.blocked = true;
      callbacks.current.onFinished(action === 'assign' ? m.alreadyPlaced : m.sourceChanged);
    } else snapshot.current = asset.data;
  }, [asset.status, asset.data, action]);
  const availableRooms = rooms.data?.filter((room) => action !== 'transfer' || room.id !== asset.data?.currentPlacement?.roomId) || [];
  const enabled = asset.status === 'ready' && !asset.stale && rooms.status === 'ready' && !rooms.stale &&
    availableRooms.length > 0 && !pending &&
    (action === 'assign' ? asset.data?.currentPlacement === null : !!asset.data?.currentPlacement);
  const selectRoom = (id: string) => { setRoomId(id); setFieldError(null); setError(null); };
  const submit = async () => {
    if (lock.current || !enabled || life.current.blocked || !life.current.active) return;
    if (!isAssetId(roomId) || !availableRooms.some((room) => room.id === roomId)) { setFieldError(m.roomRequired); return; }
    const confirmed = snapshot.current;
    if (!confirmed || action === 'transfer' && !confirmed.currentPlacement) return;
    lock.current = true; setPending(true); setError(null); setFieldError(null);
    const current = () => life.current.active && !life.current.blocked;
    const finish = (message: string, uncertain = false, toList = false) => {
      life.current.blocked = true;
      callbacks.current.onFinished(message, uncertain, toList);
    };
    try {
      if (action === 'assign') await assignAssetPlacement(assetId, { roomId }, current);
      else if (confirmed.currentPlacement) await transferAsset(assetId, { roomId, sourcePlacementId: confirmed.currentPlacement.placementId }, current);
      if (current()) finish(action === 'assign' ? m.assignSuccess : m.transferSuccess);
    } catch (failure) {
      if (!current() || isAssetAbort(failure)) return;
      if (failure instanceof AssetApiError) {
        if (failure.phase === 'uncertain') finish(m.placementUncertain, true);
        else if (failure.status === 404 && failure.message === m.roomNotFound) {
          setRoomId(''); setError(failure.message); rooms.refresh();
        } else if (failure.status === 409 && failure.message === m.sameRoom) {
          setRoomId(''); setFieldError(m.sameRoom);
        } else if (callbacks.current.onFailure(failure)) {
          life.current.blocked = true;
        } else if (failure.status === 400) finish(m.placementSelectionInvalid, false, true);
        else if (failure.status === 409 || failure.status >= 500 && failure.phase === 'write') finish(failure.message);
        else setError(failure.message);
      } else finish(m.placementUncertain, true);
    } finally {
      lock.current = false;
      if (life.current.active) setPending(false);
    }
  };
  return { asset, rooms, availableRooms, roomId, selectRoom, error, fieldError, pending, enabled, submit };
}
