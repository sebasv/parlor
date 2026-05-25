export type Locale = 'en' | 'nl'

export const LOCALES: readonly Locale[] = ['en', 'nl']

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  en: 'English',
  nl: 'Nederlands',
}

export type Orientation = 'portrait' | 'landscape'

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
  readonly title: Readonly<Record<Locale, string>>
  readonly description: Readonly<Record<Locale, string>>
  readonly minPlayers: number
  readonly maxPlayers: number
  /** Preferred device orientation. The shell shows a "rotate" overlay if mismatched. */
  readonly preferredOrientation?: Orientation
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
  /** Optional inline-SVG thumbnail (raw markup) shown on the picker card. */
  readonly thumbnail?: string
}
