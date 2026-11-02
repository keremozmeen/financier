/**
 * Shows a count on the installed app's icon via the Badging API (D5). Unsupported
 * browsers (most of iOS Safari outside an installed PWA, Firefox) simply show nothing.
 */
export function setAppBadge(count: number): void {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
  const request = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  // A denied or failed badge is cosmetic; never surface it.
  request.catch(() => {});
}
