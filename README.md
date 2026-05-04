# Vermeulen Games

A small SPA/PWA with a collection of local-multiplayer games (concurrent and hot-seat) for tablet play. Personal project, not built for a general audience.

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
    registry.ts      list of games; each entry uses dynamic import
    <game-id>/       one folder per game; default-exports a GameModule
  lib/
    game.ts          GameModule + GameContext interfaces
    storage.ts       persistence helpers
```

### Game contract

Each game default-exports a `GameModule` from `src/lib/game.ts`:

```ts
{
  id, title, description, minPlayers, maxPlayers,
  mount(root: HTMLElement, ctx: { players, onExit }): cleanup
}
```

The shell hands the game an empty `<div>` to own. The game returns a cleanup function that removes its DOM and cancels any timers / animation frames / event listeners. The shell never touches game DOM directly. This keeps each game self-contained and framework-agnostic — a game can use Solid, plain DOM, or a `<canvas>` render loop without affecting the shell.

Games are loaded via dynamic `import()` so each becomes its own Vite chunk and is only fetched when picked.

To add a game:

1. Create `src/games/<game-id>/index.ts` exporting a `GameModule` as default.
2. Add an entry to `src/games/registry.ts`.

## Commands

```bash
pnpm dev          # Vite dev server with HMR
pnpm build        # Type-check + production build → dist/
pnpm preview      # Serve dist/ locally
pnpm check        # Biome lint + format check
pnpm check:fix    # Auto-fix
```

## Hosting (Cloudflare Pages)

The app is fully static. One-time setup:

1. Push to GitHub (already wired up).
2. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the `vermeulen-games` repo.
4. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `pnpm build`
   - **Build output directory:** `dist`
   - **Node version:** 24 (set via `NODE_VERSION` env var if needed)
5. Deploy. Subsequent pushes to `main` auto-deploy.

Custom domain can be wired under the Pages project's **Custom domains** tab.
