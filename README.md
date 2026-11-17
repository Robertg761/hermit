# Hermit

Learn the real command line for your OS, one tiny lesson at a time.

Hermit is a browser game that teaches the terminal the way language apps teach languages: short lessons, XP, streaks, hearts and a hermit crab named Herme who has opinions. You pick your OS first, and every lesson uses that OS's real commands: Bash on Linux, zsh on macOS and PowerShell on Windows.

Entry for [Hackyard](https://hackyard.tech) Yard #7, theme "Remix". See [`SPEC.md`](SPEC.md) for the full plan.

**Play it:** https://hermit-shell.vercel.app

## What's in it

- **Three real shells.** Bash on Linux, zsh on macOS and PowerShell 7 on Windows, with each one's real output, error wording and exit codes.
- **Five units, 17 lessons:** getting around, files and folders, finding things, pipes and redirects, processes and permissions.
- **Taught like a language app.** Every command gets a short card, then you type along, pick, match, build it from tiles, and finally do it yourself. Nothing is tested before it is taught.
- **Herme catches wrong-OS habits.** Type `ls -la` in PowerShell or `Remove-Item` in Bash and he explains the difference.
- **Hearts, XP, streaks, and a shell for every unit you finish.**
- **Secrets.** There are 8 easter eggs. They never cost a heart.

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
src/ui/         React screens, the xterm.js terminal, Herme
```

What is and isn't simulated: [`SIMPLIFICATIONS.md`](SIMPLIFICATIONS.md).
