import type { Locale } from './game'

interface ShellStrings {
  readonly games: string
  readonly players: string
  readonly addPlayer: string
  readonly add: string
  readonly back: string
  readonly howToPlay: string
  readonly loading: string
  readonly loadFailed: string
  readonly language: string
  readonly playerCount: (min: number, max: number) => string
}

export const SHELL_STRINGS: Readonly<Record<Locale, ShellStrings>> = {
  en: {
    games: 'Games',
    players: 'Players',
    addPlayer: 'Add player',
    add: 'Add',
    back: 'Back',
    howToPlay: 'How to play',
    loading: 'Loading…',
    loadFailed: 'Failed to load game.',
    language: 'Language',
    playerCount: (min, max) => (min === max ? `${min} players` : `${min}–${max} players`),
  },
  nl: {
    games: 'Spellen',
    players: 'Spelers',
    addPlayer: 'Speler toevoegen',
    add: 'Toevoegen',
    back: 'Terug',
    howToPlay: 'Spelregels',
    loading: 'Laden…',
    loadFailed: 'Spel laden mislukt.',
    language: 'Taal',
    playerCount: (min, max) => (min === max ? `${min} spelers` : `${min}–${max} spelers`),
  },
}
