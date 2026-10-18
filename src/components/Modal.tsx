"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  id: string;
  drawer?: boolean;
  /** Prevent light-dismiss (click-outside / Esc) while an action is running. */
  locked?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Native <dialog> modal: top-layer, focus trap, Esc handling, light dismiss. */
export default function Modal({ open, onClose, title, id, drawer, locked, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const lightDismiss = locked ? undefined : "any";

  return (
    <dialog
      ref={ref}
      id={id}
      className={drawer ? "drawer" : undefined}
      aria-labelledby={`${id}-title`}
      {...(lightDismiss ? ({ closedby: lightDismiss } as object) : { closedby: "none" })}
      onCancel={(e) => {
        if (locked) e.preventDefault();
      }}
      onClose={onClose}
      onClick={(e) => {
        // Fallback for browsers without closedBy support (e.g. Safari).
        if (locked) return;
        const d = ref.current;
        if (!d || e.target !== d) return;
        const r = d.getBoundingClientRect();
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) d.close();
      }}
    >
      {open && (
        <>
          <div className="dialog-head">
            <h2 id={`${id}-title`} style={{ fontSize: 19 }}>{title}</h2>
            <button
              className="icon-btn"
              aria-label="Close dialog"
              disabled={locked}
              onClick={() => ref.current?.close()}
            >
              ✕
            </button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
