import { createEffect, createResource, onCleanup, Show } from 'solid-js'
import type { GameEntry } from '../lib/game'

interface Props {
  entry: GameEntry
  players: readonly string[]
  onExit: () => void
}

export function GameHost(props: Props) {
  const [mod] = createResource(
    () => props.entry,
    (e) => e.load(),
  )
  let host: HTMLDivElement | undefined

  // Mount the game into a Solid-untouched div once the module is ready.
  // The game owns the DOM inside `host`; we only call its cleanup on teardown.
  createEffect(() => {
    const m = mod()
    const root = host
    if (!m || !root) return

    const cleanup = m.mount(root, {
      players: props.players,
      onExit: props.onExit,
    })

    onCleanup(cleanup)
  })

  return (
    <section class="game-host">
      <header>
        <button type="button" onClick={props.onExit}>
          ← Back
        </button>
        <h2>{props.entry.title}</h2>
      </header>
      <Show when={mod.loading}>
        <p>Loading…</p>
      </Show>
      <Show when={mod.error}>
        <p>Failed to load game.</p>
      </Show>
      <div ref={host} class="game-root" />
    </section>
  )
}
