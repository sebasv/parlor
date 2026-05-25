import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { GameEntry, Locale } from './lib/game'
import { tryLockOrientation } from './lib/orientation'
import { shuffled } from './lib/shuffle'
import { loadLocale, loadPlayers, saveLocale } from './lib/storage'
import { ConfirmDialog } from './shell/ConfirmDialog'
import { GameHost } from './shell/GameHost'
import { GamePicker } from './shell/GamePicker'
import { LocaleToggle } from './shell/LocaleToggle'
import { MetaMenu } from './shell/MetaMenu'
import { PlayerRoster } from './shell/PlayerRoster'
import { RulesScreen } from './shell/RulesScreen'

// Pseudo-routing: when the user enters a game we push a history entry so the
// browser/PWA back gesture lands on a popstate we can intercept (instead of
// closing the SPA and leaving a blank screen).
const HISTORY_MARK = { vg: 'in-game' as const }

const CONFIRM_LABELS: Record<
  Locale,
  { title: string; body: string; quit: string; cancel: string }
> = {
  en: {
    title: 'Quit game?',
    body: 'Your progress will be lost.',
    quit: 'Quit',
    cancel: 'Keep playing',
  },
  nl: {
    title: 'Spel verlaten?',
    body: 'Je voortgang gaat verloren.',
    quit: 'Verlaten',
    cancel: 'Doorspelen',
  },
}

export default function App() {
  const [players, setPlayers] = createSignal<readonly string[]>(loadPlayers())
  const [active, setActive] = createSignal<GameEntry | null>(null)
  // Order passed to the game; reshuffled on every pick so the starting player
  // (== gamePlayers()[0]) rotates randomly.
  const [gamePlayers, setGamePlayers] = createSignal<readonly string[]>([])
  const [showRules, setShowRules] = createSignal(false)
  const [confirmExit, setConfirmExit] = createSignal(false)
  const [locale, setLocaleSig] = createSignal<Locale>(loadLocale())

  const setLocale = (l: Locale) => {
    setLocaleSig(l)
    saveLocale(l)
  }

  const pushHistoryMark = () => {
    if (history.state?.vg !== 'in-game') {
      history.pushState(HISTORY_MARK, '')
    }
  }

  const pick = (entry: GameEntry) => {
    setGamePlayers(shuffled(players()))
    setActive(entry)
    setShowRules(Boolean(entry.rules))
    pushHistoryMark()
  }

  const exitToPicker = () => {
    setActive(null)
    setShowRules(false)
    setConfirmExit(false)
    if (history.state?.vg === 'in-game') {
      history.back()
    }
  }

  const requestExit = () => {
    setConfirmExit(true)
  }

  // Intercept the system back gesture / browser back: re-push our marker and
  // route the action through the same confirm dialog the on-screen Back button
  // uses. Without this, users land on a blank page in installed PWAs.
  onMount(() => {
    const handler = () => {
      if (active()) {
        pushHistoryMark()
        if (showRules()) {
          // Back from a rules overlay just closes the overlay.
          setShowRules(false)
        } else {
          requestExit()
        }
      }
    }
    window.addEventListener('popstate', handler)
    onCleanup(() => window.removeEventListener('popstate', handler))
  })

  // Best-effort orientation lock when a game has a preference. Silently
  // ignored on browsers that don't support it (notably iOS) — CSS handles
  // either orientation, no rotate-nag overlay.
  createEffect(() => {
    const target = active()?.preferredOrientation
    if (target) tryLockOrientation(target)
  })

  const labels = () => CONFIRM_LABELS[locale()]
  const inGame = () => active() !== null

  return (
    <main class="app" data-view={inGame() ? 'play' : 'picker'}>
      <Show
        when={inGame()}
        fallback={
          <>
            <header class="app-header">
              <h1>Parlor Games</h1>
              <LocaleToggle locale={locale} setLocale={setLocale} />
              <MetaMenu locale={locale} />
            </header>
            <PlayerRoster players={players} setPlayers={setPlayers} locale={locale} />
            <GamePicker playerCount={() => players().length} locale={locale} onPick={pick} />
          </>
        }
      >
        {(_) => {
          const entry = active()
          if (!entry) return null
          return (
            <GameHost
              entry={entry}
              players={gamePlayers()}
              locale={locale}
              onExit={requestExit}
              onShowRules={entry.rules ? () => setShowRules(true) : undefined}
            />
          )
        }}
      </Show>

      <Show when={inGame() && showRules() && active()}>
        {(_) => {
          const entry = active()
          if (!entry) return null
          return (
            <div class="rules-overlay">
              <RulesScreen
                entry={entry}
                locale={locale}
                setLocale={setLocale}
                onStart={() => setShowRules(false)}
                onBack={() => setShowRules(false)}
              />
            </div>
          )
        }}
      </Show>

      <ConfirmDialog
        open={confirmExit}
        title={labels().title}
        body={labels().body}
        confirmLabel={labels().quit}
        cancelLabel={labels().cancel}
        onConfirm={exitToPicker}
        onCancel={() => setConfirmExit(false)}
      />
    </main>
  )
}
