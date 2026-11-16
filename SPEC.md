# Hermit: Terminal Lessons Build Spec (Hackyard Yard #7)

Nov 16, 2026 · @Robert

## Overview

Hermit is a browser game that teaches the command line the way Duolingo teaches languages: short lessons, XP, streaks, hearts and a mascot that guilt-trips you. The twist is that you pick your OS first, and every lesson uses that OS's real commands: Bash on Linux, zsh on macOS, PowerShell on Windows. "Hermit" is a working name; the mascot is Shellby, an original hermit crab (it lives in a shell).

It's the entry for Hackyard Yard #7, theme "Remix": take something that exists and rebuild it your way. The remix here is Duolingo's learning loop applied to the terminal.

### Constraints

- Solo build. Kickoff Mon Nov 16, 18:00 UTC (2:30 pm NST). Ship Fri Nov 20, 18:00 UTC (2:30 pm NST). No code before kickoff.
- Any AI model is allowed.
- Deliverables: a public repo and a live demo URL.
- Judging: other builders open each build and rank their top 3. Hermit must be playable within 10 seconds of opening the link: no install, no signup.

### Success criteria

- A live URL where picking an OS and starting the first lesson takes one click each.
- Units 1 to 5 complete and playable on all three OSes. This is the minimum shippable entry.
- Any valid command that achieves a challenge's goal passes. Checks look at the resulting state, never at the exact typed string.
- XP, streak and completed lessons survive a page reload.
- Stretch: Rosetta mode ("I know Linux, teach me PowerShell"), AI explanations of mistakes, units 6 to 8.

### Non-goals

- No real shell. User input is never executed on any machine; everything runs against a simulated filesystem.
- No accounts, database or leaderboards.
- No mobile layout beyond not breaking. Show a "best on a desktop" note on small screens.
- No cmd.exe. Windows means PowerShell 7 syntax, with a note only where Windows PowerShell 5.1 differs in a way learners will hit.
- No full POSIX or PowerShell emulation. Only the commands and flags the curriculum uses, plus a friendly "Hermit doesn't simulate that yet" message for anything else.

## Product

The core loop: pick your OS, open a lesson, type real commands into a fake terminal until the goal is met, earn XP, keep your streak.

### Screens

1. **Landing.** One-line pitch, Shellby, and three big buttons: Linux, macOS, Windows. Pre-highlight the visitor's OS from the user agent. A smaller link below: "Switching OS? Try Rosetta mode."
2. **Skill tree.** Units as a vertical path of lesson nodes. A node unlocks when the one before it is done. Header shows OS, XP, streak flame and a switch-OS button.
3. **Lesson.** Challenge prompt on top, terminal below, Shellby in a corner reacting. 3 hearts per lesson and a progress bar across the top.
4. **Lesson complete.** XP earned, streak update, a Shellby line, "Next lesson" button.

### Challenge types

- **Do** (the main type). The terminal starts with a seeded filesystem. The learner types commands until the goal state is reached. The check runs after every command, so there is no Submit button.
- **Predict.** Show a command and a filesystem, pick the output from 3 or 4 options. Quick variety between Do challenges.
- **Fix.** A broken command is pre-typed at the prompt, often one from the wrong OS (`rm -rf old` in PowerShell). Edit it so it works.
- **Translate** (Rosetta mode only). Given a command in the OS you know, reach the same result in the OS you're learning.

### Hearts and mistakes

- A command that errors (unknown command, wrong syntax for this OS, missing file) costs 1 heart.
- A successful read-only command (`ls`, `pwd`, `cat`) never costs a heart. Exploring is encouraged.
- Deleting or overwriting a file the challenge marks as protected costs 1 heart and resets that challenge's filesystem.
- At 0 hearts the lesson restarts. No timers, no waiting to refill.
- After 2 failed attempts on a challenge, a Hint button pulses. After 3, the hint may reveal the answer.

### Progress

- 10 XP per challenge, plus 5 if solved with no hint and no lost heart.
- Streak counts consecutive local calendar days with at least one completed lesson.
- Progress is per OS, so a learner can run a Linux track and a Windows track side by side.

### Rosetta mode

The learner picks "I know" and "Teach me" (for example, Linux to Windows). Lessons come from the "Teach me" OS, and each challenge shows the known-OS command as a ghost hint ("On Linux you'd type `ls -a`"). Translate challenges appear in every lesson. The data already holds every OS's commands for every challenge, so this mode is mostly UI.

### Shellby

An original hermit crab drawn as inline SVG with five states: idle, happy, sad, smug, asleep. Do not use anything resembling Duolingo's owl, green palette, name or sounds. Shellby reacts to events with short lines, for example:

- Wrong-OS command: "That's Linux talk. In PowerShell we say `Remove-Item`."
- Lesson complete: "Not bad. My shell is slightly less ashamed of you."
- Returning after a missed day: "Your streak is 0. Even my shell has more commitment."
- Three lessons in a row: "Okay, show-off."

Keep 3 to 5 lines per event and pick one at random so repeat plays feel alive.

### Terminal feel

- Prompts per OS: `you@hermit:~$` (Linux), `you@Hermits-MacBook ~ %` (macOS), `PS C:\Users\you>` (Windows).
- Up and down arrows for history, Ctrl+C to cancel the line, Ctrl+L or `clear` / `cls` to clear, paste supported.
- Tab completion of file and folder names is a nice-to-have for Thursday.
- Monospace font, OS-flavoured colours: dark purple-black for Ubuntu-ish Linux, light or dark Terminal.app look for macOS, PowerShell blue for Windows.

### Easter eggs (cheap delight for voters)

- `sudo rm -rf /` or `Remove-Item C:\ -Recurse -Force`: Shellby faints, the screen flickers, then "Nice try. This is a simulation."
- `exit`: "You can't leave. You have a streak."
- `vim`: a one-challenge bonus lesson called "How do I exit vim".
- `say hello` on macOS actually speaks, using the browser's speech synthesis.
- `fastfetch` or `neofetch` on Linux prints a crab in ASCII with fake system info. Mentioning Arch earns a "btw" badge.

## Architecture

Everything runs in the browser against an immutable virtual filesystem. Each OS is a dialect: a parser plus a table of command handlers. The only server code is one function that proxies AI hint requests.

&#91;embedded content: Hermit architecture · 4 layers, 3 providers\]

A lesson sends each typed line to the chosen OS's dialect, the dialect returns a new MachineState, and the engine checks the goal against it. Only the hint request goes over the network.

### Stack

| Piece | Choice |
| --- | --- |
| Language | TypeScript, `strict: true`, no `any` |
| Build | Vite |
| UI | React |
| Terminal | `@xterm/xterm` with `@xterm/addon-fit` |
| Tests | Vitest |
| Hosting | Vercel (static site plus one serverless function) |
| AI hints | Anthropic API, `claude-haiku-5-5`, called only from `/api/hint` |
| Persistence | `localStorage`, behind a swappable storage provider |

### Folder structure

```
src/
  domain/                # pure TypeScript, no React or DOM imports
    vfs/                 # filesystem types and pure operations
    shell/               # tokenizer, parser, pipeline runner
    dialects/
      bash/              # Linux commands
      zsh/               # macOS: extends bash, adds and overrides
      powershell/        # cmdlets, aliases, object pipeline
      wrong-os.ts        # cross-dialect mistake table
    lessons/             # challenge runner, goal evaluation, scoring
    progress/            # XP, streak, hearts (pure)
  content/
    units/               # one file per unit, lesson data only
  providers/
    storage.ts           # localStorage adapter
    hints.ts             # AI hint client with canned fallback
  ui/
    terminal/            # xterm wrapper and line editor
    screens/             # Landing, SkillTree, Lesson, LessonComplete
    mascot/              # Shellby SVG and lines
api/
  hint.ts                # Vercel function
```

### Domain model

```ts
type OS = 'linux' | 'mac' | 'windows';

type VNode =
  | { kind: 'file'; content: string; executable?: boolean }
  | { kind: 'dir'; children: Readonly<Record<string, VNode>> };

type Process = { pid: number; name: string; cpu: number };

type MachineState = {
  root: VNode;                       // one tree; dialects map display paths onto it
  cwd: readonly string[];            // path segments from root
  home: readonly string[];
  env: Readonly<Record<string, string>>;
  processes: readonly Process[];
  installed: readonly string[];      // simulated packages
  isAdmin: boolean;
  executionPolicy?: 'Restricted' | 'RemoteSigned';
};

type Effect =
  | { kind: 'clear' }
  | { kind: 'speak'; text: string }
  | { kind: 'clipboard'; text: string }
  | { kind: 'easterEgg'; id: string };

type CommandResult = {
  state: MachineState;
  stdout: string;
  stderr: string;
  exitCode: number;
  effects: readonly Effect[];
};

type CommandHandler = (args: readonly string[], input: PipeInput, state: MachineState) => CommandResult;

type Dialect = {
  os: OS;
  prompt: (state: MachineState) => string;
  formatPath: (segments: readonly string[]) => string;   // '/home/you' vs 'C:\\Users\\you'
  parsePath: (raw: string, state: MachineState) => readonly string[] | null;
  caseInsensitive: boolean;                               // true for PowerShell
  commands: Readonly<Record<string, CommandHandler>>;
  aliases: Readonly<Record<string, string>>;
  run: (line: string, state: MachineState) => CommandResult;
};
```

`PipeInput` is text for Bash and zsh, and an array of typed objects (files, processes, strings) for PowerShell. PowerShell formats objects to text only at the end of a pipeline.

### Virtual filesystem rules

- Immutable. Every command returns a new `MachineState`. No mutation anywhere in `domain/`.
- One internal tree per challenge. Linux shows `/home/you`, macOS shows `/Users/you`, Windows shows `C:\Users\you`. The challenge seed is written once in a neutral form and mapped by each dialect.
- Globs (`*.txt`) are expanded by the Bash and zsh parsers and by PowerShell's `-Filter` and wildcard paths.
- Hidden files: dotfiles on Linux and macOS. On Windows, a `hidden` flag that `Get-ChildItem -Force` reveals.

### Dialects

- **Bash (Linux).** Text pipelines. Supports `|`, `>`, `>>`, `<`, `&&`, `;`, single and double quotes, `$VAR` expansion, `~`.
- **zsh (macOS).** Reuses Bash's parser and handlers, then adds `open`, `pbcopy`, `pbpaste`, `say`, `brew`, `mdfind`, `sw_vers`, `caffeinate`, `defaults`. Prompt and home path differ.
- **PowerShell (Windows).** Case-insensitive cmdlets, parameters and paths. Aliases `ls`, `dir`, `cd`, `cat`, `type`, `rm`, `del`, `cp`, `mv`, `pwd`, `echo`, `cls`, `clear`, `mkdir` map to cmdlets. Supports `|`, `>`, `>>`, `;`, `&&` (PowerShell 7), `$env:NAME`, `$HOME`, `$PROFILE`. `Where-Object` supports only the simple form `Where-Object Name -like '*.txt'` (operators `-eq`, `-ne`, `-like`, `-gt`, `-lt`). Script-block syntax `{ $_... }` gets a friendly "not simulated yet" message.
- **Wrong-OS table.** `wrong-os.ts` maps commands from other dialects to this one: `ls -la` in PowerShell suggests `Get-ChildItem -Force`, `dir` in Bash suggests `ls`, `rm -rf` in PowerShell suggests `Remove-Item -Recurse -Force`, `cls` in Bash suggests `clear`. When a command fails and appears in this table, show the canned explanation immediately. This is the main teaching moment and works without AI.

### Lesson engine

Goals are declarative data, so lesson content never contains functions:

```ts
type Goal =
  | { kind: 'exists'; path: string; type?: 'file' | 'dir' }
  | { kind: 'notExists'; path: string }
  | { kind: 'fileContains'; path: string; text: string }
  | { kind: 'fileEquals'; path: string; text: string }
  | { kind: 'cwdIs'; path: string }
  | { kind: 'stdoutIncludes'; text: string }          // last command's output
  | { kind: 'envIs'; name: string; value: string }
  | { kind: 'processGone'; name: string }
  | { kind: 'installed'; pkg: string }
  | { kind: 'all'; goals: readonly Goal[] };

type Challenge = {
  id: string;
  type: 'do' | 'predict' | 'fix' | 'translate';
  prompt: Record<OS, string>;
  seed: Record<OS, SeedState>;          // or a shared seed
  goal: Record<OS, Goal>;
  solutions: Record<OS, readonly string[][]>;   // one or more command sequences that pass
  protectedPaths?: readonly string[];
  hints: Record<OS, readonly string[]>;
  explain: Record<OS, string>;          // shown after success, one or two sentences
  options?: readonly string[];          // predict challenges only
  prefill?: Record<OS, string>;         // fix challenges only
};
```

Runner flow after each Enter: run the line through the dialect, then apply hearts rules, then evaluate the goal against the new state and output, then show success or the error with its explanation.

### AI hints

- `POST /api/hint` with `{ os, prompt, command, stderr, attempt }`. Returns `{ hint }`.
- The function calls `claude-haiku-5-5` with `max_tokens: 150` and a 4 second timeout. On timeout or error the client uses the challenge's canned hint.
- System prompt: you are Shellby, a sarcastic but kind hermit crab teaching the {os} terminal. Explain in at most 2 short sentences why the command failed and what to look at. Do not give the full answer unless attempt is 3 or more. Use only {os} syntax.
- The key lives in the Vercel env var `ANTHROPIC_API_KEY`, never in client code. Add a simple in-memory per-IP limit of 30 requests per 10 minutes.

### Persistence

One `localStorage` key, `hermit:v1`:

```json
{ "os": "linux", "rosetta": null, "tracks": { "linux": { "xp": 120, "completed": ["u1-l1"] } }, "streak": { "count": 1, "lastDay": "2026-11-16" } }
```

Wrap reads and writes in try/catch. If storage fails, keep progress in memory for the session.

## Curriculum

Eight units share one skill tree; each row below is one challenge, with the main command per OS. Because checks are state-based, other valid commands also pass (aliases, other flags, `dir` instead of `Get-ChildItem`). Units 1 to 5 are the minimum shippable set. Split each unit into 1 or 2 lessons of 5 to 8 challenges, mixing in Predict and Fix challenges built from the same commands.

### Unit 1: Getting around

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| Where am I? | `pwd` | `pwd` | `Get-Location` (alias `pwd`) |
| List files | `ls` | `ls` | `Get-ChildItem` (aliases `ls`, `dir`) |
| Show hidden files | `ls -a` | `ls -a` | `Get-ChildItem -Force` |
| Detailed list | `ls -l` | `ls -l` | `Get-ChildItem` (details are the default) |
| Go into a folder | `cd projects` | `cd projects` | `Set-Location projects` (alias `cd`) |
| Go up, go home | `cd ..`, `cd ~` | `cd ..`, `cd ~` | `cd ..`, `cd ~` |

### Unit 2: Files and folders

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| Make a folder | `mkdir notes` | `mkdir notes` | `New-Item -ItemType Directory notes` (or `mkdir notes`) |
| Make an empty file | `touch todo.txt` | `touch todo.txt` | `New-Item todo.txt` |
| Read a file | `cat todo.txt` | `cat todo.txt` | `Get-Content todo.txt` (aliases `cat`, `type`) |
| Copy a file, copy a folder | `cp a.txt b.txt`, `cp -r src backup` | `cp a.txt b.txt`, `cp -r src backup` | `Copy-Item a.txt b.txt`, `Copy-Item src backup -Recurse` |
| Move or rename | `mv old.txt new.txt` | `mv old.txt new.txt` | `Move-Item old.txt new.txt` or `Rename-Item old.txt new.txt` |
| Delete a file, delete a folder | `rm junk.txt`, `rm -r junk` | `rm junk.txt`, `rm -r junk` | `Remove-Item junk.txt`, `Remove-Item junk -Recurse` |

### Unit 3: Finding things

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| Search inside a file | `grep "TODO" app.js` | `grep "TODO" app.js` | `Select-String "TODO" app.js` |
| Search a whole folder | `grep -r "TODO" .` | `grep -r "TODO" .` | `Get-ChildItem -Recurse \| Select-String "TODO"` |
| Find files by name | `find . -name "*.log"` | `find . -name "*.log"` | `Get-ChildItem -Recurse -Filter *.log` |
| First and last lines | `head -n 5 log.txt`, `tail -n 5 log.txt` | `head -n 5 log.txt`, `tail -n 5 log.txt` | `Get-Content log.txt -TotalCount 5`, `Get-Content log.txt -Tail 5` |
| Count lines | `wc -l log.txt` | `wc -l log.txt` | `Get-Content log.txt \| Measure-Object -Line` |

### Unit 4: Pipes and redirects

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| Pipe one command into another | `ls \| grep txt` | `ls \| grep txt` | `Get-ChildItem \| Where-Object Name -like "*txt*"` |
| Sort and dedupe | `sort names.txt \| uniq` | `sort names.txt \| uniq` | `Get-Content names.txt \| Sort-Object -Unique` |
| Write output to a file | `ls > files.txt` | `ls > files.txt` | `Get-ChildItem > files.txt` |
| Append to a file | `echo "done" >> log.txt` | `echo "done" >> log.txt` | `"done" >> log.txt` or `Add-Content log.txt "done"` |
| Chain commands | `mkdir out && cd out` | `mkdir out && cd out` | `mkdir out; cd out` (`&&` works in PowerShell 7) |
| Three biggest files | `ls -S \| head -n 3` | `ls -S \| head -n 3` | `Get-ChildItem \| Sort-Object Length -Descending \| Select-Object -First 3` |

The Windows track gets one extra explanation here: PowerShell pipes objects, not text, which is why `Sort-Object Length` works without parsing columns.

### Unit 5: Processes and permissions

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| List running programs | `ps aux` | `ps aux` | `Get-Process` |
| Find one program | `pgrep -l runaway` | `pgrep -l runaway` | `Get-Process -Name runaway` |
| Stop a runaway program | `pkill runaway` or `kill 4242` | `pkill runaway` or `kill 4242` | `Stop-Process -Name runaway` or `Stop-Process -Id 4242` |
| Run a script | `chmod +x build.sh`, then `./build.sh` | `chmod +x build.sh`, then `./build.sh` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then `.\build.ps1` |
| Run as admin | `sudo <command>` | `sudo <command>` | `Start-Process pwsh -Verb RunAs` (Windows 11 24H2 also has an optional `sudo`) |

Seed a fake process list with a few normal programs and one `runaway` process at 99% CPU. Running a script before fixing permissions must fail with the real-looking error.

### Unit 6: Installing software (stretch)

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| Search for a package | `apt search jq` (also `pacman -Ss jq`, `dnf search jq`) | `brew search jq` | `winget search jq` |
| Install a package | `sudo apt install jq` (also `sudo pacman -S jq`, `sudo dnf install jq`) | `brew install jq` | `winget install jqlang.jq` |
| Update everything | `sudo apt update && sudo apt upgrade` (also `sudo pacman -Syu`) | `brew update && brew upgrade` | `winget upgrade --all` |

Installing on Linux without `sudo` fails with a permission error; that is a deliberate teaching moment. Use a small fake package registry and fake progress output. After install, the package's command works in the terminal.

### Unit 7: Environment and PATH (stretch)

| Skill | Linux (Bash) | macOS (zsh) | Windows (PowerShell) |
| --- | --- | --- | --- |
| Print a variable | `echo $HOME` | `echo $HOME` | `$env:USERPROFILE` (or `$HOME`) |
| Set a variable for this session | `export EDITOR=nano` | `export EDITOR=nano` | `$env:EDITOR = "notepad"` |
| See your PATH | `echo $PATH` | `echo $PATH` | `$env:Path` |
| Where does a command live? | `which git` | `which git` | `Get-Command git` |
| Make it permanent | `echo 'export EDITOR=nano' >> ~/.bashrc` | `echo 'export EDITOR=nano' >> ~/.zshrc` | `Add-Content $PROFILE '$env:EDITOR = "notepad"'` |

### Unit 8: Party tricks (stretch)

This unit is different per OS on purpose. Each row is one challenge on that OS only.

| OS | Challenges |
| --- | --- |
| Linux | `xdg-open .`, `df -h`, `uname -a`, `systemctl status bluetooth`, `fastfetch` |
| macOS | `open .`, `say "hello"` (really speaks), `pbcopy < notes.txt` then `pbpaste`, `caffeinate -t 3600`, `sw_vers` |
| Windows | `Get-Help Get-ChildItem`, `Get-Command *process*`, `Invoke-Item .` (alias `ii`), `Get-Content notes.txt \| Set-Clipboard`, `Get-Service` |

## Build plan

Five phases, one per day. Wednesday night is the checkpoint: units 1 to 5 must be playable on all three OSes by then, and everything after that is polish and stretch. Each phase ends with its acceptance checks passing and a deploy.

### Phase 0: Before kickoff (Mon, before 2:30 pm NST)

Robert only, no code.

- [ ] Claim a Yard #7 spot and check in on hackyard.tech
- [ ] Create the empty GitHub repo and link a Vercel project to it
- [ ] Add `ANTHROPIC_API_KEY` to the Vercel project's environment variables
- [ ] Drop this spec into the repo as `SPEC.md`

### Phase 1: Foundation (Mon evening)

Goal: one Linux lesson playable end to end on a live URL.

1. Scaffold Vite, React, strict TypeScript, ESLint, Vitest.
2. Terminal component: xterm.js with a line editor (typing, backspace, left and right arrows, Enter, history, Ctrl+C, Ctrl+L, paste).
3. `domain/vfs`: types, path resolution, read, write, mkdir, remove, copy, move, list. Unit tests for each.
4. `domain/shell`: Bash tokenizer handling quotes, `~`, `$VAR`, globs.
5. Bash dialect with `pwd`, `ls` (`-a`, `-l`), `cd`, `mkdir`, `touch`, `cat`, `echo`, `rm` (`-r`), `clear`.
6. One hard-coded lesson (Unit 1, Lesson 1) with a goal check and a success message.
7. Deploy to Vercel.

Acceptance:

- [ ] Live URL loads straight into a working terminal
- [ ] Unit 1 Lesson 1 can be completed on Linux
- [ ] `npm test` passes, with VFS and Bash command tests

### Phase 2: Engine and all three dialects (Tue)

Goal: units 1 and 2 on all three OSes. PowerShell is the riskiest part of the project, so it happens today, not later.

1. Lesson engine: declarative goals, challenge runner, hearts rules, protected paths, lesson-complete screen.
2. Content format in `content/units/`, with per-OS prompts, seeds, goals, solutions, hints and explanations.
3. zsh dialect on top of Bash: macOS paths and prompt.
4. PowerShell dialect: case-insensitive cmdlets, aliases, Windows paths, the minimal object pipeline, and the Unit 1 and 2 cmdlets.
5. `wrong-os.ts` with at least 20 cross-dialect mistakes and their explanations.
6. Landing screen with OS picker, and the skill tree screen.
7. Write units 1 and 2 content for all three OSes.

Acceptance:

- [ ] Units 1 and 2 playable on Linux, macOS and Windows
- [ ] `rm -rf junk` in PowerShell fails and explains `Remove-Item -Recurse -Force`
- [ ] Golden-solution test passes for every challenge on every OS (see Testing)

### Phase 3: Content and progress (Wed)

Goal: the minimum shippable entry. If Thursday disappears, this ships.

1. Commands for units 3 to 5: `grep` (`-r`), `find -name`, `head`, `tail`, `wc -l`, `sort`, `uniq`, pipes, `>`, `>>`, `&&`, `;`, `ps`, `pgrep`, `kill`, `pkill`, `chmod`, `sudo`, and in PowerShell `Select-String`, `Where-Object`, `Sort-Object`, `Select-Object`, `Measure-Object`, `Get-Process`, `Stop-Process`, `Set-ExecutionPolicy`, `Start-Process`.
2. Units 3 to 5 content for all three OSes, including Predict and Fix challenges.
3. Progress: XP, streak, per-OS tracks, saved through the storage provider.
4. Shellby: SVG with five states, event lines, reactions wired to the runner.

Acceptance:

- [ ] Units 1 to 5 playable on all three OSes
- [ ] Progress survives a reload
- [ ] Shellby reacts to a wrong command, a success and a completed lesson
- [ ] Robert has played Unit 1 on each OS and checked the commands against his real Arch, Windows 11 and M1 Mac machines

### Phase 4: Stretch and polish (Thu)

Work in this order and stop wherever the day ends.

1. AI hints: `/api/hint`, Hint button, timeout and canned fallback, rate limit.
2. Rosetta mode: "I know" and "Teach me" picker, ghost hints, Translate challenges.
3. Easter eggs (cheap and high-delight).
4. Units 6 to 8, with the fake package registry and `say` through speech synthesis.
5. Polish: landing page copy, transitions, sound effects with a mute toggle, tab completion, small-screen note.

Acceptance:

- [ ] Every feature that shipped today works on the live URL in Chrome, Firefox and Safari
- [ ] Hints still work with the API key removed, using canned fallbacks

### Phase 5: Ship (Fri, deadline 2:30 pm NST / 18:00 UTC)

Feature freeze at 10 am NST. Submit by noon to leave a buffer.

- [ ] README: one-line pitch, GIF, live link, how to run locally, stack, what is simulated and what isn't
- [ ] A 60-second demo video: pick Windows, fail with `rm -rf`, Shellby roasts you, fix it, finish a lesson, flip to Rosetta mode
- [ ] Final deploy, then a cold playthrough in a private window on each browser
- [ ] Submit the repo and demo on Hackyard

## Testing, cuts and risks

The golden-solution test is the most important test in the repo: it proves every challenge is solvable on every OS, so content bugs can't reach voters.

### Testing

- **Unit tests** (Vitest) for every VFS operation, the tokenizers and parsers, and every command handler, including its error output.
- **Golden-solution test.** For every challenge and every OS: build the seed state, run each solution sequence through that OS's dialect, and assert the goal is met. Also assert that the seed state does *not* already meet the goal. A challenge with no solution for an OS fails the test.
- **Wrong-OS test.** Every entry in `wrong-os.ts` fails in its dialect and returns its explanation.
- **Real-machine check.** Robert runs the main command of each Unit 1 to 3 challenge on Arch, Windows 11 and the M1 Mac, and compares output shape and error wording with Hermit's. Differences are fixed or listed in `SIMPLIFICATIONS.md`.

### Cut list

If the schedule slips, cut from the top of this list first:

1. Rosetta mode
2. AI hints (keep the canned hints and the wrong-OS explanations)
3. Unit 8
4. Unit 7
5. Unit 6
6. Predict and Fix challenge types (keep Do only)

Never cut: all three OSes for units 1 to 5, state-based checking, the wrong-OS explanations, Shellby.

### Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| PowerShell dialect takes longer than planned | High | Build it Tuesday. Implement only the syntax the curriculum uses; script blocks get a "not simulated yet" message. |
| A lesson uses a wrong or unrealistic command | High | Golden-solution test, plus Robert's real-machine check. |
| Lesson content takes longer to write than code | High | Write one unit's content per OS in a single pass from the curriculum tables. Agents draft, Robert spot-checks. |
| Cleaning shifts eat build time | Medium | Wednesday-night checkpoint and the cut list. |
| xterm line-editing quirks (paste, arrows, wide characters) | Medium | Keep the editor minimal and test paste early. |
| AI hint cost, latency or abuse | Low | Haiku, `max_tokens: 150`, 4 second timeout, per-IP limit, canned fallback. |
| Voters open it on a phone | Low | Small-screen note; the landing page still looks good. |

## Agent instructions

Read this whole spec before starting, then work one phase at a time. These rules apply to every phase.

### Scope

- Work only on the current phase. When its acceptance checks pass, deploy, stop, and report what shipped, what was simplified and what is next.
- Ask Robert before you add a dependency outside the stack table, change the curriculum, add any backend beyond `/api/hint`, or cut something from the cut list.
- Keep `main` deployable at all times. Commit small with conventional commit messages (`feat:`, `fix:`, `content:`, `test:`).

### Code

- Strict TypeScript, no `any`, no non-null assertions to silence the compiler.
- Small pure functions. Everything in `src/domain/` is pure and imports nothing from React, the DOM or `src/ui/`.
- UI components stay thin: they call domain functions and render results.
- Storage and hints go through `src/providers/`, so either can be swapped without touching domain code.
- Never execute user input: no `eval`, no `Function`, no real shell, no network calls with user-typed text except the hint request body.
- The Anthropic key is only read in `api/hint.ts`, never shipped to the client.

### Commands and content

- Every new command gets a handler, tests for success and error cases, and an entry in that dialect's command list.
- Match real behaviour for the flags the curriculum uses: output shape, error wording, exit codes. When you simplify, add a line to `SIMPLIFICATIONS.md`.
- Every challenge has, for each OS: a prompt, a seed, a goal, at least one solution, at least one canned hint and a one-or-two sentence explanation. The golden-solution test must pass before a commit.
- Write prompts in plain, friendly English addressed to the learner ("Make a folder called notes"), never with the answer in the prompt.

### Brand

- The remix is the learning loop, not the brand. No owl, no Duolingo green, name, fonts, sounds or copy.
- Shellby is an original hermit crab drawn from scratch in SVG.
