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

export function OrientationGuard(props: Props) {
  const [actual, setActual] = createSignal<Orientation>(currentOrientation())

  onMount(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const handler = () => setActual(currentOrientation())
    mql.addEventListener('change', handler)
    onCleanup(() => mql.removeEventListener('change', handler))
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
    const p = props.preferred()
    return p !== null && p !== actual()
  }

  // Re-attempt lock whenever preference changes.
  let lastTarget: Orientation | null = null
  const maybeLock = () => {
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
