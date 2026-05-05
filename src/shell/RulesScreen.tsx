import { For, Show } from 'solid-js'
import { type GameEntry, LOCALE_LABELS, LOCALES, type Locale, type RulesContent } from '../lib/game'

interface Props {
  entry: GameEntry
  locale: () => Locale
  setLocale: (l: Locale) => void
  onStart: () => void
  onBack: () => void
}

const FALLBACK_LABELS: Record<Locale, { start: string; back: string; missing: string }> = {
  en: {
    start: 'Start game',
    back: 'Back',
    missing: 'No rules written for this game yet.',
  },
  nl: {
    start: 'Start spel',
    back: 'Terug',
    missing: 'Voor dit spel zijn nog geen regels geschreven.',
  },
}

export function RulesScreen(props: Props) {
  const content = (): RulesContent | null => {
    const r = props.entry.rules
    if (!r) return null
    return r[props.locale()] ?? r.en ?? null
  }

  const labels = () => FALLBACK_LABELS[props.locale()]

  return (
    <section class="rules-screen">
      <header class="rules-header">
        <button type="button" class="rules-back" onClick={props.onBack}>
          ←
        </button>
        <h2>{content()?.title ?? props.entry.title}</h2>
        <fieldset class="rules-locale">
          <legend class="rules-locale-legend">Language</legend>
          <For each={LOCALES}>
            {(l) => (
              <button
                type="button"
                class="rules-locale-btn"
                aria-pressed={props.locale() === l}
                data-active={props.locale() === l}
                onClick={() => props.setLocale(l)}
              >
                {LOCALE_LABELS[l]}
              </button>
            )}
          </For>
        </fieldset>
      </header>

      <div class="rules-body">
        <Show when={content()} fallback={<p>{labels().missing}</p>}>
          {(c) => (
            <For each={c().sections}>
              {(section) => (
                <section class="rules-section">
                  <h3>{section.heading}</h3>
                  <Show when={section.paragraphs?.length}>
                    <For each={section.paragraphs}>{(p) => <p>{p}</p>}</For>
                  </Show>
                  <Show when={section.bullets?.length}>
                    <ul>
                      <For each={section.bullets}>{(b) => <li>{b}</li>}</For>
                    </ul>
                  </Show>
                </section>
              )}
            </For>
          )}
        </Show>
      </div>

      <footer class="rules-footer">
        <button type="button" class="rules-start" onClick={props.onStart}>
          {labels().start}
        </button>
      </footer>
    </section>
  )
}
