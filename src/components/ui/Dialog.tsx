import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';
import { currentDialogDepth, popDialogEntry, pushDialogEntry } from './dialogHistory';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Whether a tap on the dimmed backdrop closes the dialog (default true). Turn it off
   * while the dialog holds input the user would lose by a stray tap; the X button,
   * Escape and "back" still close it.
   */
  dismissOnBackdrop?: boolean;
}

const FOCUSABLE = 'input, button, select, textarea, [href]';

/** Open dialogs; the background page only scrolls again once the last one closes. */
let scrollLocks = 0;
let previousOverflow = '';

/**
 * Modal dialog. It closes with the X button, a tap on the backdrop, Escape, or the
 * phone's own "back" (iOS edge swipe, Android back, browser back) through a history
 * entry of its own. Focus moves inside on open, stays trapped there and returns on close;
 * the page behind does not scroll while it is open.
 */
export function Dialog({ title, onClose, children, dismissOnBackdrop = true }: DialogProps) {
  const t = useT();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const pressedBackdrop = useRef(false);
  /** Depth of this dialog's history entry, kept across StrictMode's effect re-run. */
  const entry = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    (
      body.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel.current?.querySelector<HTMLElement>(FOCUSABLE)
    )?.focus();

    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    entry.current ??= pushDialogEntry();
    const depth = entry.current;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab' && panel.current) trapFocus(event, panel.current);
    };
    // "Back" landed below our entry: the user left the dialog.
    const onPop = () => {
      if (currentDialogDepth() < depth) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);

    return () => {
      mounted.current = false;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
      previous?.focus();
      // StrictMode re-runs this effect right away; only a real unmount gives up the entry.
      queueMicrotask(() => {
        if (mounted.current) return;
        entry.current = null;
        popDialogEntry(depth);
      });
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      data-testid="dialog-backdrop"
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Only a tap that starts and ends on the backdrop closes; a drag out of the panel does not.
        const fromBackdrop = pressedBackdrop.current && event.target === event.currentTarget;
        pressedBackdrop.current = false;
        if (fromBackdrop && dismissOnBackdrop) closeRef.current();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="pt-2 font-display text-xl font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => closeRef.current()}
            className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-fg"
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>
        <div ref={body} className="mt-3 space-y-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function trapFocus(event: KeyboardEvent, container: HTMLElement) {
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('disabled'),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
