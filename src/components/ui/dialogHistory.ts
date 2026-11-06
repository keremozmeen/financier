/**
 * Ties open dialogs to the browser history so the phone's own "back" (iOS edge swipe,
 * Android back button, browser back) closes a dialog instead of leaving the page.
 *
 * Opening a dialog pushes one entry on top of the current page (same URL, the router's
 * state is kept so it never notices). Going back pops that entry and the dialog closes.
 * Closing any other way (X, backdrop, Escape, an action) steps back over the entry so no
 * phantom entry remains. Each entry carries its dialog's depth, so a dialog opened from
 * another dialog stacks correctly.
 */

const KEY = 'financierDialog';

/** Depth of the dialog entry the history currently sits on; 0 when it is a plain page. */
export function currentDialogDepth(): number {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && KEY in state) {
    const depth = (state as Record<string, unknown>)[KEY];
    if (typeof depth === 'number') return depth;
  }
  return 0;
}

/** Pushes the entry for a dialog that just opened and returns its depth. */
export function pushDialogEntry(): number {
  const depth = currentDialogDepth() + 1;
  const state: unknown = window.history.state;
  const base = state && typeof state === 'object' ? state : {};
  window.history.pushState({ ...base, [KEY]: depth }, '');
  return depth;
}

/** The "back" we asked for and are still waiting on; history moves asynchronously. */
let pending: Promise<void> | null = null;

function stepBack(): Promise<void> {
  pending ??= new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('popstate', done);
      clearTimeout(timer);
      pending = null;
      resolve();
    };
    // A safety valve: never leave the user stuck if a browser drops the popstate.
    const timer = setTimeout(done, 1000);
    window.addEventListener('popstate', done);
    window.history.back();
  });
  return pending;
}

/** Called when a dialog closes by any means other than "back": removes its entry if it is on top. */
export function popDialogEntry(depth: number) {
  if (!pending && currentDialogDepth() === depth) void stepBack();
}

/**
 * Steps back over the top dialog entry before navigating away from a dialog, so the next
 * navigation lands on the page underneath and adds exactly one entry (or replaces that
 * page). Resolves once the history is there; at once when no dialog entry is on top.
 */
export function leaveDialogHistory(): Promise<void> {
  if (pending) return pending;
  return currentDialogDepth() === 0 ? Promise.resolve() : stepBack();
}
