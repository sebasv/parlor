# Parlor Games

A small SPA/PWA with a collection of local-multiplayer games (concurrent and hot-seat) for tablet play.

## Stack

- **Vite + TypeScript + Solid** — small bundle, no virtual DOM, signals for reactive state.
- **vite-plugin-pwa** — service worker, web manifest, offline support.
- **Biome** — single binary for lint + format.
- Storage: `localStorage` for now; `idb` will be added when a game needs IndexedDB.

## Architecture

```
src/
  index.tsx          entry; renders <App>, registers SW
  App.tsx            shell — picker ↔ game host
  styles.css         shell styles
  shell/             Solid components for the shell only
  games/
    registry.ts      glob-based discovery — no edits needed when adding games
    <game-id>/
      meta.ts          default-exports GameMeta (id, title, description, min/maxPlayers, optional rules + preferredOrientation)
      index.ts         default-exports GameModule (meta + mount fn)
      thumbnail.svg    optional inline-SVG card thumbnail shown on the picker
  lib/
    game.ts          GameMeta + GameModule + GameContext interfaces
    storage.ts       persistence helpers
```

### Game contract

Each game has two files:

- `meta.ts` — default-exports a `GameMeta` (eagerly imported by the registry; tiny, no game logic).
- `index.ts` — default-exports a `GameModule` (lazy-loaded as its own Vite chunk).

```ts
// meta.ts
const meta: GameMeta = { id, title, description, minPlayers, maxPlayers }
export default meta

// index.ts
const game: GameModule = {
  ...meta,
  mount(root: HTMLElement, ctx: { players, onExit }) {
    // build DOM inside root, wire listeners
    return () => {
      // cleanup: remove DOM, cancel timers / rAF / listeners
    }
  },
}
export default game
```

The shell hands the game an empty `<div>` to own. The game returns a cleanup function. The shell never touches game DOM directly — a game can use Solid, plain DOM, or `<canvas>` independently of the shell.

**Adding a game:** create `src/games/<game-id>/meta.ts` and `src/games/<game-id>/index.ts`. The registry uses `import.meta.glob` to auto-discover them. No registry edits.

See `src/games/placeholder/` for a minimal working example.

Each game folder also carries a `<game-id>-design.md` documenting the design choices made for that implementation, including any deviations from canonical rules. Read it before changing a game.

### How-to-play / rules

Each game's `meta.ts` may include an optional `rules: Record<Locale, RulesContent>` field. When present, the shell shows a "How to play" screen between picker and game with a language toggle (EN / NL persisted to localStorage), and a `?` button in the game header re-opens it during play. Games without `rules` go straight to play. See `src/games/placeholder/meta.ts` for the structure (`title?`, `sections: [{ heading, paragraphs?, bullets? }]`).

## Commands

```bash
pnpm dev          # Vite dev server with HMR
pnpm dev:netlify  # Same, wrapped in `netlify dev` (use to exercise Netlify Forms locally)
pnpm build        # Type-check + production build → dist/
pnpm preview      # Serve dist/ locally
pnpm check        # Biome lint + format check
pnpm check:fix    # Auto-fix
```

`pnpm dev:netlify` fetches the Netlify CLI on demand via `pnpm dlx`, so
no entry is added to `devDependencies`. First run will be slower while
the CLI is cached.
