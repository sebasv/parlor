export type Locale = 'en' | 'nl'

export const LOCALES: readonly Locale[] = ['en', 'nl']

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  en: 'English',
  nl: 'Nederlands',
}

export interface RulesSection {
  readonly heading: string
  readonly paragraphs?: readonly string[]
  readonly bullets?: readonly string[]
}

export interface RulesContent {
  readonly title?: string
  readonly sections: readonly RulesSection[]
}

export interface GameMeta {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly minPlayers: number
  readonly maxPlayers: number
  /** Optional how-to-play content keyed by locale. Shown before the game starts. */
  readonly rules?: Readonly<Record<Locale, RulesContent>>
}

export interface GameContext {
  readonly players: readonly string[]
  readonly onExit: () => void
}

export interface GameModule extends GameMeta {
  /** Mount the game into root. Return a cleanup that detaches DOM and cancels timers. */
  mount(root: HTMLElement, ctx: GameContext): () => void
}

export interface GameEntry extends GameMeta {
  readonly load: () => Promise<GameModule>
}
