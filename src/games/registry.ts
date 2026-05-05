import type { GameEntry, GameMeta, GameModule } from '../lib/game'

// Auto-discover games by globbing each game folder.
//   src/games/<id>/meta.ts        — default-export GameMeta (eagerly loaded)
//   src/games/<id>/index.ts       — default-export GameModule (lazy-loaded chunk)
//   src/games/<id>/thumbnail.svg  — optional inline SVG (eagerly loaded as raw string)
//
// Adding a new game = creating those files. No edits to this file.
const metas = import.meta.glob<{ default: GameMeta }>('./*/meta.ts', { eager: true })
const loaders = import.meta.glob<{ default: GameModule }>('./*/index.ts')
const thumbs = import.meta.glob<string>('./*/thumbnail.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function dirOf(path: string): string {
  const m = path.match(/^\.\/(.+)\/[^/]+$/)
  if (!m) throw new Error(`unexpected path in registry glob: ${path}`)
  return m[1]
}

export const games: readonly GameEntry[] = Object.entries(metas)
  .map(([path, mod]): GameEntry => {
    const dir = dirOf(path)
    const loader = loaders[`./${dir}/index.ts`]
    if (!loader) throw new Error(`game "${dir}" has meta.ts but no index.ts`)
    const thumbnail = thumbs[`./${dir}/thumbnail.svg`]
    return {
      ...mod.default,
      load: () => loader().then((m) => m.default),
      thumbnail,
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title))
