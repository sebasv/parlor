import { For, Show } from 'solid-js'
import { games } from '../games/registry'
import type { GameEntry } from '../lib/game'

interface Props {
  playerCount: () => number
  onPick: (entry: GameEntry) => void
}

export function GamePicker(props: Props) {
  const playable = (g: GameEntry) =>
    props.playerCount() >= g.minPlayers && props.playerCount() <= g.maxPlayers

  return (
    <section class="picker">
      <h2>Games</h2>
      <ul class="game-grid">
        <For each={games}>
          {(g) => (
            <li>
              <button
                type="button"
                class="game-card"
                disabled={!playable(g)}
                onClick={() => props.onPick(g)}
              >
                <Show
                  when={g.thumbnail}
                  fallback={<div class="game-thumb game-thumb-placeholder">{g.title}</div>}
                >
                  {/* Thumbnails are static SVGs authored in this repo — no XSS surface. */}
                  {/* eslint-disable-next-line solid/no-innerhtml */}
                  <div class="game-thumb" innerHTML={g.thumbnail} />
                </Show>
                <h3>{g.title}</h3>
                <p>{g.description}</p>
                <small>
                  {g.minPlayers}–{g.maxPlayers} players
                </small>
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  )
}
