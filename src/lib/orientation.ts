import type { Orientation } from './game'

// Best-effort orientation lock. Only succeeds in fullscreen / installed PWA on
// browsers that implement Screen Orientation API (notably absent on iOS
// Safari). On failure we silently let the user play in whatever orientation
// the device is in — no nag overlay.
export function tryLockOrientation(target: Orientation): void {
  const so = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } })
    .orientation
  so?.lock?.(target).catch(() => {
    /* unsupported or not allowed — accepted; CSS handles either orientation */
  })
}
