import { createSignal, For } from 'solid-js'
import type { Locale } from '../lib/game'
import { savePlayers } from '../lib/storage'
import { SHELL_STRINGS } from '../lib/strings'

interface Props {
  players: () => readonly string[]
  setPlayers: (next: string[]) => void
  locale: () => Locale
}

export function PlayerRoster(props: Props) {
  const [draft, setDraft] = createSignal('')
  const t = () => SHELL_STRINGS[props.locale()]

  const add = (e: Event) => {
    e.preventDefault()
    const name = draft().trim()
    if (!name) return
    const next = [...props.players(), name]
    props.setPlayers(next)
    savePlayers(next)
    setDraft('')
  }

  const remove = (idx: number) => {
    const next = props.players().filter((_, i) => i !== idx)
    props.setPlayers(next)
    savePlayers(next)
  }

  return (
    <section class="roster">
      <h2>{t().players}</h2>
      <ul class="roster-list">
        <For each={props.players()}>
          {(name, i) => (
            <li>
              <span>{name}</span>
              <button type="button" onClick={() => remove(i())}>
                ×
              </button>
            </li>
          )}
        </For>
      </ul>
      <form onSubmit={add}>
        <input
          type="text"
          placeholder={t().addPlayer}
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
        />
        <button type="submit">{t().add}</button>
      </form>
    </section>
  )
}
