# CLAUDE.md

Notes for Claude Code working on this repo. For stack, architecture, the game
contract, how to add a game, the rules-content shape, commands, and hosting,
read [README.md](./README.md) first — it is the source of truth.

## Audience

Personal project: a tablet-first SPA/PWA of local-multiplayer games for the
Vermeulen kids, who are Dutch and roughly ages 6-12. Not built for a general
audience. Match that audience in copy and UI choices: large tap targets,
short sentences, no jargon. Rules text ships in EN + NL.

## Tooling

- Use **pnpm**. The repo's `.npmrc` pins this project to public npm and
  overrides a global config that points at Source.ag CodeArtifact. Do not
  remove it; do not run `npm install`.
- Lint + format: **Biome** (`pnpm check`, `pnpm check:fix`). Single quotes,
  no semicolons, 2-space indent, 100 col.
- TypeScript strict. Avoid `any` and non-null assertions.
- No emojis in code, commits, or UI text.

## Quality gates

There is no CI yet. Before opening a PR run all three locally:

```bash
pnpm check:fix && pnpm check
pnpm build
```

## Git workflow

- `main` is branch-protected: direct push is rejected. All changes go through
  a PR (squash-merge).
- Feature branches: `feature/<short-name>` (e.g. `feature/checkers`,
  `feature/rules-a`). Conventional Commits.
- The user's email override (`mail@sebastiaanvermeulen.nl`) lives in global
  git config; do not touch it.

## Working on multiple games in parallel

Each game lives in its own folder (`src/games/<id>/`) and is auto-discovered
by the glob registry, so changes to different games never conflict. To run
several agents at once, use git worktrees on separate feature branches:

```bash
git worktree add /tmp/vg-worktrees/<id> -b feature/<id> main
```

Keep each branch scoped to a single game folder (or to a single shell
concern). Do not edit `src/games/registry.ts` — it auto-discovers.

## Per-game simplifications

Several games shipped with v1 simplifications relative to their canonical
rules (e.g. Tsuro generates random tiles instead of using the 35-tile deck;
Codenames Duet uses an independent-per-player key; Backgammon relaxes the
"must use both dice if possible" rule). Each trade-off is recorded in the
game's `<game-id>-design.md`. Read it before changing rules behaviour, and
keep the rules text in `meta.ts` aligned with what is actually playable —
not with the canonical board-game spec.

## Game-meta fields

`GameMeta` (in `src/lib/game.ts`) supports several optional fields a game can
populate:

- `preferredOrientation: 'portrait' | 'landscape'` — the shell makes a
  best-effort `screen.orientation.lock()` attempt (works in installed-PWA /
  fullscreen on supporting browsers; silently noops on iOS Safari). There is
  no rotate-nag overlay — games must keep their layouts usable in either
  orientation.
- `rules: Record<Locale, RulesContent>` — bilingual how-to-play content shown
  in an overlay before the game starts and re-openable via `?` mid-game.

Each game folder may also contain `thumbnail.svg` — an inline SVG (eagerly
imported as a raw string) shown on the game card in the picker. Aim for ~16:10
aspect, mid-game scene, calm flat colours.

## UI localisation gap

Rules content is bilingual (EN + NL) but in-game UI strings are currently
hard-coded English. NL rules text may name buttons in Dutch even though
the actual button label is English — that mismatch is known. Full UI
localisation is its own project; in the meantime, when adding a button
reference in NL rules, prefer the English button name (e.g. "Tik op
Confirm") to keep kids unconfused.

## Dependencies

Default to **no new dependencies**. The shipped exceptions are
`chess.js` + `chessground` (justified in `src/games/chess/chess-design.md`)
and `workbox-window` for the PWA service worker. Justify any further
addition in the relevant design doc and prefer hand-rolling small
utilities inline.
