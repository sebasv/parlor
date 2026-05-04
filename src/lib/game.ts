export interface GameMeta {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly minPlayers: number
  readonly maxPlayers: number
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
