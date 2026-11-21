import type { PaymentPolicyRoute } from '../types/roomPaymentPolicy';
import { roomServicesReturnTo } from './roomServiceNavigation';

export const paymentPolicyReturnTo = roomServicesReturnTo;
export function parsePaymentPolicyRoute(pathname: string, search: string): PaymentPolicyRoute | null {
  const match = /^\/rooms\/([^/]+)\/payment-policy\/?$/.exec(pathname);
  if (!match) return null;
  let roomId = match[1];
  try { roomId = decodeURIComponent(roomId); } catch { /* The API boundary rejects malformed identities. */ }
  return { roomId, returnTo: paymentPolicyReturnTo(new URLSearchParams(search).get('returnTo')) };
}
export function paymentPolicyUrl(roomId: string, returnTo?: string): string {
  const back = paymentPolicyReturnTo(returnTo);
  return '/rooms/' + encodeURIComponent(roomId) + '/payment-policy' + (back === '/rooms' ? '' : '?returnTo=' + encodeURIComponent(back));
}
