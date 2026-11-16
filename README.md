# Hermit

Learn the real command line for your OS, one tiny lesson at a time.

Hermit is a browser game that teaches the terminal the way language apps teach languages: short lessons, XP, streaks, hearts and a hermit crab named Shellby who has opinions. You pick your OS first, and every lesson uses that OS's real commands: Bash on Linux, zsh on macOS and PowerShell on Windows.

Entry for [Hackyard](https://hackyard.tech) Yard #7, theme "Remix". See [`SPEC.md`](SPEC.md) for the full plan.

> Status: Phase 1 (Linux, Unit 1 Lesson 1). macOS and Windows arrive next.

## Run locally

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest, including the golden-solution test
npm run lint
npm run build
```

## How it works

Nothing you type is executed. Each OS is a *dialect* (a parser plus command handlers) running against an immutable, in-memory filesystem. Lesson goals are declarative checks on the resulting state, so any valid command that reaches the goal passes, not just the one in the answer key.

```
src/domain/     pure TypeScript: filesystem, shell parser, dialects, lesson engine
src/content/    lesson data, one file per unit
src/ui/         React screens, the xterm.js terminal, Shellby
```

What is and isn't simulated: [`SIMPLIFICATIONS.md`](SIMPLIFICATIONS.md).
