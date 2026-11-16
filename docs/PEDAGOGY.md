# How Hermit teaches

Hermit is for people who have never opened a terminal. The first version of Unit 1 opened with "Print the full path of the folder you are standing in", which only works if you already know what a path, a folder in a terminal, and `pwd` are. This doc fixes that. It sets out the teaching techniques Hermit borrows from how Duolingo teaches languages, what each one means for the terminal, the challenge types they need, and a rewritten Unit 1 to use as the template for every other unit.

The subject is the terminal, not programming. Learners are typing commands to look around and change their own computer. No code, no scripts until Unit 5.

Where this doc differs from SPEC.md on lesson shape (number and size of lessons, challenge types), this doc wins. Robert asked for the rework on 2026-11-16.

## The one rule

**Never test what you haven't taught.** Every command, flag and symbol is shown and explained before any challenge asks the learner to produce it. A challenge may only use skills that a Learn card introduced earlier in the course. This is checkable in a test (see [Engine and test changes](#engine-and-test-changes)).

## Techniques, and what they mean for the terminal

Each row says what Duolingo does, where that comes from, and how Hermit translates it.

| # | Technique | What Duolingo does | In Hermit |
| --- | --- | --- | --- |
| 1 | **Small, known-plus-one steps** | Each lesson adds only a handful of new words (5 to 7) inside sentences made of things you already know. Their designers aim for "i + 1": just past what you know. [1] | At most **2 new skills per lesson** (a skill is a command, a flag, or a symbol like `..` or `~`). Everything else in the lesson uses old skills. A terminal skill is heavier than a word, so the budget is smaller. |
| 2 | **Introduce before you test** | A new word is flagged as new the first time it appears, and you can tap any word to see what it means. Hints make even new material understandable. [1][2] | A **Learn card** before every new skill: what it does, how to say it ("pwd = print working directory"), and a real example running in the terminal. New words in prompts (folder, path, flag) get a dotted underline you can tap for a one-line definition. |
| 3 | **Recognise before you produce** | Early exercises ask for little output (pick a picture, match pairs, tap words from a word bank). Typing and speaking come later. [3] | A ladder for every new skill: **Learn → Type along → Pick or Match → Build → Do**. Free typing (Do) comes last, once the learner has seen, recognised and assembled the command. |
| 4 | **Word bank before keyboard** | Translations are first built by tapping word tiles, so learners aren't blocked by spelling. | **Build** challenges: tap command tokens (`ls`, `-a`, `cd`, `..`) to assemble the command, with a couple of plausible wrong tiles. This teaches the shape `command -flag argument`, including the space before the flag, without typos getting in the way. |
| 5 | **Learn by doing, explain briefly** | Learners interact from the very first lesson. Explanations are short, optional, and mostly come alongside or after practice. [2][4] | Learn cards are one or two sentences plus a live example, never a page of text. The longer "why" goes in the `explain` line shown after success, and in a per-unit cheat sheet. |
| 6 | **Immediate, corrective feedback** | Every answer is marked at once, with the correct answer shown when you're wrong. Mistakes are treated as part of learning. [4] | The goal check runs after every command (already in the spec). New: an **error decoder** that puts a plain-English line under real error messages ("command not found means the terminal has no command with that name"). Reading errors is a terminal skill, so we teach it instead of hiding the error. |
| 7 | **Retry what you missed** | Exercises you get wrong come back later in the same lesson, and the lesson doesn't end until you've got them right. | A challenge you lost a heart on, or needed the answer-revealing hint for, is **re-queued at the end of the lesson** once (as a fresh copy). |
| 8 | **Mix in review** | Lessons include exercises sampled from earlier skills. Duolingo uses these to measure and strengthen recall. [5] | Every lesson includes **at least 2 review challenges** from earlier lessons, authored into the content (not random, so the golden test covers them). |
| 9 | **Spaced repetition** | A model (half-life regression) estimates how fast each word fades from memory and schedules practice before you forget. [6][7] | Lightweight version: track each skill's last-practised date and success in `localStorage`, and offer a **Practice** button that pulls challenges for the weakest and most-faded skills. Stretch, see priorities. |
| 10 | **Apply in a new context** | Lessons move from simple examples to the same pattern in new contexts. [2] | After the drills, each lesson ends with a **capstone Do** that needs two skills together in a situation the learner hasn't seen ("find the tidepool photo and go to its folder"). |
| 11 | **Bite-size sessions** | Lessons take a few minutes. [2] | 8 to 10 challenges per lesson, most of them 10 to 20 seconds. A lesson should take 2 to 4 minutes. |
| 12 | **Motivation and personality** | Points, streaks, encouragement, humour that makes content stick. [2] | Already in the spec: XP, streaks, hearts, Shellby. New: Shellby's lines can carry the mnemonics ("pwd is not your password. Please don't type your password here."). |

The terminal adds three things a language course doesn't have, and they are where Hermit can be better than a straight copy:

- **A visible world.** Commands change a filesystem. A small **burrow map** (a folder tree with a "you are here" marker that moves when you `cd`) next to the terminal plays the role of Duolingo's pictures: it gives every command a meaning you can see. Show it by default in Unit 1 and 2, and make it a toggle afterwards, so the learner gradually relies on `pwd` and `ls` instead.
- **A grammar.** A command line reads like a sentence: the command is the verb, the argument is the thing it acts on, and a flag is an adverb that changes how. `ls -a photos` is "list, all of them, in photos". PowerShell says it out loud: `Get-ChildItem` is literally verb-noun. Learn cards use this framing.
- **A bridge from what they know.** Every learner has used Finder or File Explorer. First-time Learn cards connect to it: your home folder is the one File Explorer opens to, `ls` shows what you'd see in that window, `cd` is double-clicking a folder.

## Challenge types

Existing types stay. New ones are in bold. Hearts: only challenges where the learner is producing or choosing an answer can cost a heart.

| Type | Ladder rung | What the learner does | Costs hearts? |
| --- | --- | --- | --- |
| **Learn** | Introduce | Reads a short card about one new skill, sees it run, taps Continue. | No |
| **Type along** | Introduce | The command is shown as grey ghost text at the prompt. They type over it and press Enter, and see the result. | No |
| **Pick** | Recognise | A question ("Which command shows where you are?") with 3 or 4 commands to choose from, or a command with 3 or 4 meanings. | Yes |
| **Match** | Recognise | Tap pairs to match 4 or 5 commands to plain-English meanings. | No (wrong taps just shake) |
| Predict | Recognise | Pick the output of a command (existing). | Yes |
| **Build** | Assemble | Tap tokens from a bank to build the command, then it runs in the terminal and the goal is checked. | Yes |
| **Fill** | Assemble | A command with a gap (`cd ___`) and 3 or 4 tiles for it. Runs like Build. | Yes |
| Fix | Produce | Edit a pre-typed broken command (existing). Running the untouched broken line once is free, so the learner can read the error. | Yes, after that |
| Do | Produce | Type a command from scratch to reach the goal (existing). The first Do for a skill shows the Hint button from the start. | Yes |
| Translate | Produce | Rosetta mode only (existing). | Yes |

Design notes:

- **Wrong options are real misconceptions,** not random words: `pwd` meaning "password", `list` instead of `ls`, `cd up` instead of `cd ..`, `ls-a` without the space, `Get-Directory` on Windows. Each wrong option gets its own one-line reason, shown when picked.
- **Build and Fill run for real.** The assembled line goes through the dialect and the normal goal check, so a different correct combination from the tiles also passes, consistent with the spec's "state, not string" rule.
- **Type along still teaches typing.** If what they type doesn't match the ghost, the line runs anyway (it's a real terminal) and Shellby says "Close. Type the grey text exactly." No heart lost.
- **Names are ours.** Use plain labels in the UI: "New command", "Type along", "Pick one", "Match", "Build it", "Fill the gap". No Duolingo names, colours or sounds (see the spec's brand rules).

## The error decoder

Errors are where beginners give up. Generalise the spec's `wrong-os.ts` into a small table of error patterns per dialect, each with a plain-English line that appears under the real error:

| Real error | Decoder line |
| --- | --- |
| `bash: pdw: command not found` / `zsh: command not found: pdw` / `The term 'pdw' is not recognized...` | There's no command called `pdw`. Check the spelling. |
| `cd: projects/gaem: No such file or directory` / `Cannot find path ... because it does not exist` | Nothing called `gaem` here. Run `ls` to see what's actually there. |
| `bash: ls-a: command not found` | Commands and flags need a space between them: `ls -a`. |
| `cd: notes.txt: Not a directory` | `notes.txt` is a file. You can only `cd` into folders. |

The wrong-OS entries already planned (`rm -rf` in PowerShell and so on) become rows in this table.

## Lesson recipe

Use this shape for every lesson. It is the ladder from technique 3, with review and a capstone around it.

1. Learn card for new skill A
2. Type along with A
3. Pick or Match (A, plus older skills as the wrong options)
4. Do with A (hint visible), or Build if A has flags or arguments
5. Review: one challenge from an earlier lesson
6. Learn card for new skill B
7. Build or Fill with B
8. Match or Predict mixing A, B and older skills
9. Capstone Do needing A or B together with an older skill
10. Review: one more from an earlier lesson

Then any re-queued mistakes. Lessons can drop a step when a skill is trivial (`cd ~` doesn't need a Build), but the order Learn → recognise → produce never changes.

Units 2 to 5 keep the spec's 2 lessons per unit, at 10 to 12 challenges each (with Learn and Type along being quick). Unit 1 gets 4 shorter lessons, because the learner is also meeting the terminal itself.

## Unit 1, rewritten for absolute beginners

Same seed as today (the "burrow"), plus one hidden file in `projects` for a recall challenge: `projects/.plan` on Linux and macOS, and `projects/plan.txt` with the hidden flag on Windows.

macOS is identical to Linux except home is `/Users/you` and the prompt is `you@Hermits-MacBook ~ %`. Only the Windows column is spelled out where it differs.

### Lesson 1: Hello, terminal

New: the prompt, running a command, `pwd`, reading a path. Burrow map on.

| # | Type | Content | Linux / macOS | Windows |
| --- | --- | --- | --- | --- |
| 1 | Learn | **This is a terminal.** You talk to your computer by typing. The line ending in `$` is the prompt: it means "your turn". The parts: who you are (`you`), which computer (`hermit`), and where you are (`~`, your home folder, the same one File Explorer or Finder opens to). | `you@hermit:~$` (macOS ends in `%`) | `PS C:\Users\you>`: `PS` means PowerShell, then where you are, then `>` for "your turn". |
| 2 | Learn | **pwd: where am I?** You're always standing in exactly one folder. `pwd` (print working directory) tells you which. | `pwd` | `Get-Location`. PowerShell commands are a verb and a noun: *Get* the *Location*. `pwd` also works. |
| 3 | Type along | Type it and press Enter. Explain after: "That's a path, the address of a folder. Read it left to right: from the top, into `home`, into `you`." | `pwd` → `/home/you` | `Get-Location` → `C:\Users\you` |
| 4 | Pick | What does `pwd` do? **Shows which folder you're in** / Shows your password / Lists the files here | | Same with `Get-Location`; wrong option "Gets your location on a map". |
| 5 | Predict | Shellby is in his photos folder and types `pwd`. What prints? **`/home/you/photos`** / `/photos` / `/home/you` | seed cwd `photos` | `C:\Users\you\photos` / `C:\photos` / `C:\Users\you` |
| 6 | Learn | **Mistakes are safe.** If the terminal doesn't know a word, it says so and waits again. Nothing breaks. | | |
| 7 | Fix | Shellby typed this. Run it to see the error, then fix it. Error decoder explains "command not found". | prefill `pdw` | prefill `Get-Locaton` |
| 8 | Do | Shellby moved you while you weren't looking. Find out where you are. (Hint button visible.) Goal: output includes the path. | seed cwd `projects/game`; `pwd` | `Get-Location` or `pwd` |

### Lesson 2: Look around

New: `ls`, flags, `ls -a`. Burrow map on.

| # | Type | Content | Linux / macOS | Windows |
| --- | --- | --- | --- | --- |
| 1 | Learn | **ls: what's here?** Lists what's inside the folder you're in, like opening it in File Explorer or Finder. | `ls` (list) | `Get-ChildItem`: *Get* the *child items*, the things inside. `ls` and `dir` also work. |
| 2 | Type along | Type it. Explain after: folders and files both show up. Names ending in `.txt` or `.jpg` are files. | `ls` | `Get-ChildItem` |
| 3 | Pick | You want to see what's in this folder. Which command? **`ls`** / `pwd` / `list` | | **`Get-ChildItem`** / `Get-Location` / `Get-Files` |
| 4 | Do | You're in photos. Which photos does Shellby have? Goal: output includes `tidepool.jpg`. | seed cwd `photos` | |
| 5 | Review: Pick | Which command tells you where you are? **`pwd`** / `ls` / `where` | | **`Get-Location`** / `Get-ChildItem` / `Get-Where` |
| 6 | Learn | **Flags change how a command behaves.** They start with a dash, after a space. `ls -a` means list *all*. Names starting with a dot are hidden, and `-a` shows them. | `ls -a` | Windows calls these parameters. `Get-ChildItem -Force` forces hidden files to show. Windows hides files with a hidden setting, not a dot. |
| 7 | Build | Build the command that reveals hidden files. It runs and shows `.shellby-secret`. | tiles: `ls` `-a` `pwd` `all` `a` | tiles: `Get-ChildItem` `-Force` `Get-Location` `-Show` `Force` |
| 8 | Match | `pwd` ↔ Where am I? · `ls` ↔ What's in here? · `ls -a` ↔ What's in here, hidden things too? | | `Get-Location`, `Get-ChildItem`, `Get-ChildItem -Force` |
| 9 | Do (capstone) | Something is hiding in projects too. You're in projects. Find it. Goal: output includes the hidden name. | seed cwd `projects`; `ls -a` | `Get-ChildItem -Force` |

### Lesson 3: Step inside

New: `cd folder`, `..`. Burrow map on; the "you are here" marker moves with every `cd`.

| # | Type | Content | Linux / macOS | Windows |
| --- | --- | --- | --- | --- |
| 1 | Learn | **cd: go into a folder.** Like double-clicking a folder. Afterwards, your prompt shows where you are. | `cd projects` (change directory) | `Set-Location projects`, alias `cd`. |
| 2 | Type along | Type it and watch the prompt and the map change. | `cd projects` → prompt `you@hermit:~/projects$` | `cd projects` → `PS C:\Users\you\projects>` |
| 3 | Review: Do | You're in projects now. What's inside? Goal: output includes `website`. | seed cwd `projects`; `ls` | |
| 4 | Build | Walk into the game folder. Goal: cwd is `projects/game`. | seed cwd `projects`; tiles: `cd` `game` `ls` `pwd` `into` | tiles: `Set-Location` `game` `Get-ChildItem` `Get-Location` `-Into` |
| 5 | Learn | **`..` is the folder above.** Two dots always mean "one level up". `cd ..` climbs out. | `cd ..` | Same in PowerShell. |
| 6 | Fill | You're in game. Go up one folder. `cd ___`: **`..`** / `up` / `.` / `back` | seed cwd `projects/game` | Same |
| 7 | Predict | Starting at home: `cd projects/game`, `cd ..`, `pwd`. What prints? (existing `u1-l2-c4`) | | |
| 8 | Fix | Shellby fumbled the spelling (existing `u1-l2-c5`, `cd projects/gaem`). Decoder explains "No such file or directory". | | |
| 9 | Do (capstone) | You're in website. Get to the game folder next door. Goal: cwd is `projects/game`. | seed cwd `projects/website`; `cd ..` then `cd game`, or `cd ../game` | |

### Lesson 4: Shortcuts and details

New: `~` (home), `ls -l`. Burrow map available but collapsed.

| # | Type | Content | Linux / macOS | Windows |
| --- | --- | --- | --- | --- |
| 1 | Learn | **`~` means home.** It's the `~` in your prompt. `cd ~` takes you home from anywhere. | `cd ~` (plain `cd` works too) | `cd ~` works in PowerShell too. |
| 2 | Do | You wandered deep into projects/website. Head home. (existing `u1-l2-c3`, hint visible) | | |
| 3 | Pick | Which command takes you home from *anywhere*? **`cd ~`** / `cd home` / `cd ..` / `home` | | Same |
| 4 | Learn | **`ls -l`: the long list.** Adds details. The card shows one line with labels: permissions (who can read or change it, Unit 5), size in bytes, when it last changed, name. | `ls -l` (long) | No flag needed: `Get-ChildItem` already shows details. The card labels its columns: `Mode`, `LastWriteTime`, `Length` (size in bytes), `Name`. |
| 5 | Type along | List the photos folder with details. | seed cwd `photos`; `ls -l` | `Get-ChildItem` |
| 6 | Pick | Which flag adds sizes and dates? **`-l`** / `-a` / `-size` | | Which column shows when a file last changed? **`LastWriteTime`** / `Mode` / `Length` |
| 7 | Review: Match | `pwd` · `ls` · `ls -a` · `cd ..` · `cd ~` ↔ their meanings | | PowerShell equivalents |
| 8 | Do (capstone) | Shellby lost his tidepool photo. Go to the folder it's in. Goal: cwd is `photos`. Hints: "Look around with `ls` first." | seed home | |
| 9 | Review: Do | Something is hidden in your home folder. Find it. | `ls -a` | `Get-ChildItem -Force` |

This adds roughly 17 Learn, Type along, Pick, Match, Build and Fill items to Unit 1 and reuses 5 of the current challenges.

## Engine and test changes

Sketch for the build thread. Names are suggestions.

```ts
type SkillId = string; // 'pwd', 'ls', 'ls-a', 'ls-l', 'cd', 'cd-up', 'cd-home', ...

type ChallengeType =
  | 'learn' | 'typeAlong' | 'pick' | 'match' | 'build' | 'fill'
  | 'predict' | 'do' | 'fix' | 'translate';

type Challenge = {
  // ...existing fields
  readonly teaches?: readonly SkillId[];   // Learn cards only
  readonly uses: readonly SkillId[];       // skills needed to answer
  readonly review?: boolean;               // shows a small "Review" tag
  // learn: title + body; `example` runs through the dialect so the shown output is always real
  readonly card?: PerOs<{ readonly title: string; readonly body: string; readonly example?: string }>;
  // typeAlong: the ghost text is solutions[os][0]
  // pick: reuse options + answer; add per-option reasons
  readonly optionReasons?: PerOs<readonly string[]>;
  // match
  readonly pairs?: PerOs<readonly (readonly [string, string])[]>;
  // build: token bank including distractors
  readonly tokens?: PerOs<readonly string[]>;
  // fill: a template with one gap, filled from options
  readonly template?: PerOs<string>;      // e.g. 'cd ___'
};
```

Runner:

- `learn` and `typeAlong` never cost hearts. `typeAlong` passes when the goal is met, same as Do.
- Missed challenges (lost a heart, or used the final hint) are appended once to the end of the lesson.
- The first Do for a skill shows the Hint button immediately.
- Running a Fix challenge's untouched prefill once costs no heart.

Golden test additions:

- **Taught before used:** walk the course in order; every skill in a challenge's `uses` must appear in some earlier Learn card's `teaches`. This one test enforces the rule at the top of this doc.
- Build: the first solution can be made from the token bank, and every bank token is used at most as many times as it appears.
- Fill: the template with the correct option passes the goal.
- Learn: the example command runs without an error on every OS.
- Every lesson after Unit 1 Lesson 1 has at least 2 challenges marked `review`.

## Priorities for the deadline

1. **Must:** Learn cards, Type along, Pick, Build, the taught-before-used test, and the Unit 1 rewrite on all three OSes. This alone fixes the "assumes you know it" problem.
2. **Should:** Match, Fill, the error decoder, missed-challenge re-queue, review slots in Units 2 to 5, and the burrow map.
3. **Could:** per-skill strength with fading, a Practice button, tappable glossary words, a per-unit cheat sheet.

## Sources

1. Duolingo blog, "How Duolingo finds the right level of difficulty for learners": https://blog.duolingo.com/right-level-of-difficulty
2. Duolingo blog, "The Duolingo Method": https://blog.duolingo.com/duolingo-teaching-method
3. Popular Science on the Haitian Creole course (exercises become more productive as learners progress): https://www.popsci.com/technology/duolingo-adds-haitian-creole-language-course/
4. Duolingo blog, "What is implicit learning?": https://blog.duolingo.com/what-is-implicit-learning
5. Duolingo blog, "Review exercises help measure learner recall": https://blog.duolingo.com/review-exercises-help-measure-learner-recall
6. Duolingo blog, "How we learn how you learn" (half-life regression): https://blog.duolingo.com/how-we-learn-how-you-learn
7. Settles and Meeder, "A Trainable Spaced Repetition Model for Language Learning", ACL 2016: https://aclanthology.org/P16-1174/

Behaviour described without a number (new-word flags, word banks, re-asking missed exercises) is from using the app rather than a published source. The general ideas behind the ladder are standard learning science: worked examples before problem solving, recognition before recall, retrieval practice, spacing and interleaving.
