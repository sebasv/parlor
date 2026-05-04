import { createSignal, Show } from 'solid-js'
import type { GameEntry } from './lib/game'
import { loadPlayers } from './lib/storage'
import { GameHost } from './shell/GameHost'
import { GamePicker } from './shell/GamePicker'
import { PlayerRoster } from './shell/PlayerRoster'

export default function App() {
  const [players, setPlayers] = createSignal<readonly string[]>(loadPlayers())
  const [active, setActive] = createSignal<GameEntry | null>(null)

  return (
    <main class="app">
      <Show
        when={active()}
        fallback={
          <>
            <header class="app-header">
              <h1>Vermeulen Games</h1>
            </header>
            <PlayerRoster players={players} setPlayers={setPlayers} />
            <GamePicker playerCount={() => players().length} onPick={setActive} />
          </>
        }
      >
        {(entry) => <GameHost entry={entry()} players={players()} onExit={() => setActive(null)} />}
      </Show>
    </main>
  )
}
