import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { Orientation } from '../lib/game'

interface Props {
  /** Preferred orientation for the active game. `null` = no preference. */
  preferred: () => Orientation | null
}

function currentOrientation(): Orientation {
  if (typeof window === 'undefined') return 'landscape'
  return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'
}

// Treat any device with a fine pointer (mouse / trackpad) as desktop. Laptops
// can't rotate, and a wide window almost always plays games fine in either
// orientation — the rotate nag is purely a touch/tablet concern.
function isFinePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: fine)').matches
}

export function OrientationGuard(props: Props) {
  const [actual, setActual] = createSignal<Orientation>(currentOrientation())
  const [finePointer, setFinePointer] = createSignal<boolean>(isFinePointer())

  onMount(() => {
    const orientationMql = window.matchMedia('(orientation: portrait)')
    const orientationHandler = () => setActual(currentOrientation())
    orientationMql.addEventListener('change', orientationHandler)

    const pointerMql = window.matchMedia('(pointer: fine)')
    const pointerHandler = () => setFinePointer(pointerMql.matches)
    pointerMql.addEventListener('change', pointerHandler)

    onCleanup(() => {
      orientationMql.removeEventListener('change', orientationHandler)
      pointerMql.removeEventListener('change', pointerHandler)
    })
  })

  // Best-effort lock when preference is set; ignore failure (most browsers
  // require fullscreen/installed PWA).
  const tryLock = (target: Orientation) => {
    const so = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } })
      .orientation
    so?.lock?.(target).catch(() => {
      /* unsupported or not allowed; the rotate overlay handles it */
    })
  }

  const show = () => {
    if (finePointer()) return false
    const p = props.preferred()
    return p !== null && p !== actual()
  }

  // Re-attempt lock whenever preference changes (touch devices only — fine
  // pointers don't get the auto-lock either since it's irrelevant).
  let lastTarget: Orientation | null = null
  const maybeLock = () => {
    if (finePointer()) return
    const p = props.preferred()
    if (p && p !== lastTarget) {
      lastTarget = p
      tryLock(p)
    }
  }
  // Run on every render — Solid will only re-execute when reads change.
  maybeLock()

  return (
    <Show when={show()}>
      <div class="orientation-guard" role="alert" aria-live="polite">
        <div class="orientation-guard-icon" aria-hidden="true">
          ↻
        </div>
        <p>
          Please rotate your device to <strong>{props.preferred()}</strong> mode for this game.
        </p>
      </div>
    </Show>
  )
}
