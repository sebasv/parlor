import { For } from 'solid-js'
import { LOCALE_LABELS, LOCALES, type Locale } from '../lib/game'
import { SHELL_STRINGS } from '../lib/strings'

interface Props {
  locale: () => Locale
  setLocale: (l: Locale) => void
  legend?: string
}

export function LocaleToggle(props: Props) {
  return (
    <fieldset class="locale-toggle">
      <legend class="locale-toggle-legend">
        {props.legend ?? SHELL_STRINGS[props.locale()].language}
      </legend>
      <For each={LOCALES}>
        {(l) => (
          <button
            type="button"
            class="locale-toggle-btn"
            aria-pressed={props.locale() === l}
            data-active={props.locale() === l}
            onClick={() => props.setLocale(l)}
          >
            {LOCALE_LABELS[l]}
          </button>
        )}
      </For>
    </fieldset>
  )
}
