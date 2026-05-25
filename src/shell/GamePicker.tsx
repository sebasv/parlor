import { For, Show } from 'solid-js'
import { games } from '../games/registry'
import type { GameEntry, Locale } from '../lib/game'
import { SHELL_STRINGS } from '../lib/strings'

interface Props {
  playerCount: () => number
  locale: () => Locale
  onPick: (entry: GameEntry) => void
}

export function GamePicker(props: Props) {
  const playable = (g: GameEntry) =>
    props.playerCount() >= g.minPlayers && props.playerCount() <= g.maxPlayers
  const t = () => SHELL_STRINGS[props.locale()]

  return (
    <section class="picker">
      <h2>{t().games}</h2>
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
                  fallback={
                    <div class="game-thumb game-thumb-placeholder">{g.title[props.locale()]}</div>
                  }
                >
                  {/* Thumbnails are static SVGs authored in this repo — no XSS surface. */}
                  {/* eslint-disable-next-line solid/no-innerhtml */}
                  <div class="game-thumb" innerHTML={g.thumbnail} />
                </Show>
                <h3>{g.title[props.locale()]}</h3>
                <p>{g.description[props.locale()]}</p>
                <small>{t().playerCount(g.minPlayers, g.maxPlayers)}</small>
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  )
}
