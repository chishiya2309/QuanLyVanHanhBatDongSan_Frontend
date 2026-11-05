import { useLayoutEffect, useRef, type ReactNode } from 'react';

export function PropertyDialog({ children, labelledBy, onClose, pending = false, drawer = false }: {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  pending?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflowY = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={ref} className={drawer ? 'prop-drawer' : 'prop-dialog'} aria-labelledby={labelledBy}
    aria-busy={pending || undefined}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const dialog = event.currentTarget;
      const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
        .filter((element) => !element.matches(':disabled, [tabindex="-1"], [hidden]') && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    onClick={(event) => {
      if (pending || event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    {children}
  </dialog>;
}
