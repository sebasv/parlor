import { createSignal, Match, Switch } from 'solid-js'
import type { GameEntry, Locale } from './lib/game'
import { loadLocale, loadPlayers, saveLocale } from './lib/storage'
import { GameHost } from './shell/GameHost'
import { GamePicker } from './shell/GamePicker'
import { PlayerRoster } from './shell/PlayerRoster'
import { RulesScreen } from './shell/RulesScreen'

type View = 'picker' | 'rules' | 'play'

export default function App() {
  const [players, setPlayers] = createSignal<readonly string[]>(loadPlayers())
  const [active, setActive] = createSignal<GameEntry | null>(null)
  const [view, setView] = createSignal<View>('picker')
  const [locale, setLocaleSig] = createSignal<Locale>(loadLocale())

  const setLocale = (l: Locale) => {
    setLocaleSig(l)
    saveLocale(l)
  }

  const pick = (entry: GameEntry) => {
    setActive(entry)
    setView(entry.rules ? 'rules' : 'play')
  }

  const exitToPicker = () => {
    setActive(null)
    setView('picker')
  }

  return (
    <main class="app">
      <Switch>
        <Match when={view() === 'picker' || !active()}>
          <header class="app-header">
            <h1>Vermeulen Games</h1>
          </header>
          <PlayerRoster players={players} setPlayers={setPlayers} />
          <GamePicker playerCount={() => players().length} onPick={pick} />
        </Match>
        <Match when={view() === 'rules' && active()}>
          {(_) => {
            const entry = active()
            if (!entry) return null
            return (
              <RulesScreen
                entry={entry}
                locale={locale}
                setLocale={setLocale}
                onStart={() => setView('play')}
                onBack={exitToPicker}
              />
            )
          }}
        </Match>
        <Match when={view() === 'play' && active()}>
          {(_) => {
            const entry = active()
            if (!entry) return null
            return (
              <GameHost
                entry={entry}
                players={players()}
                onExit={exitToPicker}
                onShowRules={entry.rules ? () => setView('rules') : undefined}
              />
            )
          }}
        </Match>
      </Switch>
    </main>
  )
}
