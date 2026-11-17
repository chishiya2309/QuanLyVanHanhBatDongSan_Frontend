import { paymentMessages as m, type PaymentDraft, type PaymentErrors, type PaymentSource, type RoomPaymentPolicy } from '../types/roomPaymentPolicy';

export function paymentDraft(snapshot?: RoomPaymentPolicy | null): PaymentDraft {
  return { allowCash: snapshot?.policy?.allowCash ?? false, allowTransfer: snapshot?.policy?.allowTransfer ?? false,
    cashDefaultId: snapshot?.policy?.cashDefault?.id ?? null, bankDefaultId: snapshot?.policy?.bankDefault?.id ?? null };
}
export function validatePaymentDraft(draft: PaymentDraft, choices: { CASH: PaymentSource[] | null; BANK: PaymentSource[] | null }, snapshot?: RoomPaymentPolicy | null): PaymentErrors {
  const errors: PaymentErrors = {};
  if (!draft.allowCash && !draft.allowTransfer) errors.allowCash = m.methods;
  for (const type of ['CASH', 'BANK'] as const) {
    const enabled = type === 'CASH' ? draft.allowCash : draft.allowTransfer;
    const field = type === 'CASH' ? 'cashDefaultId' : 'bankDefaultId';
    if (!enabled) continue;
    if (!draft[field]) { errors[field] = m.required; continue; }
    const saved = type === 'CASH' ? snapshot?.policy?.cashDefault : snapshot?.policy?.bankDefault;
    if (saved && saved.id === draft[field] && !saved.active) {
      errors[field] = m.inactive;
      continue;
    }
    const rows = choices[type];
    if (!rows) { errors[field] = m.sources; continue; }
    const source = rows.find(s => s.id === draft[field]);
    if (!source) errors[field] = m.sourceInvalid;
    else if (source.type !== type) errors[field] = m.sourceType;
    else if (!source.active) errors[field] = m.inactive;
  }
  return errors;
}
