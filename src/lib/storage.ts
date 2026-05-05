import { LOCALES, type Locale } from './game'

const PLAYERS_KEY = 'vg.players'
const LOCALE_KEY = 'vg.locale'

export function loadPlayers(): string[] {
  try {
    const raw = localStorage.getItem(PLAYERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function savePlayers(players: readonly string[]): void {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players))
}

export function loadLocale(): Locale {
  const raw = localStorage.getItem(LOCALE_KEY)
  if (raw && (LOCALES as readonly string[]).includes(raw)) return raw as Locale
  // First-run fallback: pick browser language if it matches a known locale, else 'en'.
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  for (const l of LOCALES) {
    if (nav.startsWith(l)) return l
  }
  return 'en'
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale)
}
