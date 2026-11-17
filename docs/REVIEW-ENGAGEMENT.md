# Engagement review: making Hermit more appealing and habit-forming

Nov 16, 2026. A review, not a build. No code was changed.

## How this was done

- Played the live app (https://hermit-shell.vercel.app) in a scripted Chromium at 1440x900 and on an emulated iPhone 13. Linux Unit 1 lessons 1 and 2, Linux Unit 4 lesson 1, Windows Unit 2 lesson 4, plus first-visit, returning, streak-lost, out-of-hearts and everything-complete states.
- Read `SPEC.md`, `docs/PEDAGOGY.md` and the UI, progress and lesson-runner code on `main` at `1649892`.
- Not checked: sound (headless browser), Firefox and Safari, real phone keyboards, and anything in the Rosetta or easter-egg work that has not reached `main`.

Effort is a rough build estimate: **S** under 1 hour, **M** 1 to 3 hours, **L** half a day or more.

## The short version

Hermit already has the loop: the ladder teaches well, the feedback sheet is satisfying, Shellby has a voice, and the wrong-OS roast is a great moment. Three things hold it back, in this order:

1. **It is slow to get to the fun.** A first-time visitor makes 5 clicks and reads 2 text cards before typing anything. Voters decide in seconds.
2. **The twist is invisible unless you make a mistake.** The remix (real commands per OS, and Shellby catching wrong-OS habits) only shows up if a voter happens to type a Linux command in PowerShell. Nothing on the landing page says so.
3. **Rewards stop at the lesson.** XP buys nothing, units and the course end with no celebration, and there is no reason to come back tomorrow beyond a number.

Top five to do before Friday:

| # | Change | Effort |
| --- | --- | --- |
| 1 | Fix the five visible bugs below (raw colour codes on a Lesson 2 card is the worst) | S |
| 2 | First visit: OS click goes straight into Lesson 1, and Lesson 1 opens on a live terminal | S |
| 3 | Show the twist on the landing page: one task, three shells | M |
| 4 | "Next lesson" button on the complete screen, and a gentler out-of-hearts | S |
| 5 | Shell collection: Shellby moves into a new shell when you finish a unit | M |

## What already works (keep it)

- **The teaching ladder.** Learn, type along, pick, build, do. Nothing was tested before it was taught in any lesson played.
- **The feedback sheet.** Colour, sound, "Flawless! +15 XP" and a one-line explanation. This is the core dopamine hit and it lands.
- **The wrong-OS moment.** `rm -rf junk` in PowerShell returns the real error, then Shellby explains `Remove-Item junk -Recurse -Force`. This is the best 5 seconds in the app.
- **Forgiving details.** Type along never costs a heart, Fix gives a free run, missed challenges come back once as "Second try".
- **Phones.** Tile, pick and match challenges work well at 390px wide, and there is no horizontal scroll. Better than the spec's "not breaking".
- **Brand.** Coral, sea and navy palette, an original crab, plain labels. Nothing resembles the owl, the green or the name.

## Fix first: bugs a voter will see

All small. These undercut polish more than any missing feature.

| Bug | Where | Effort |
| --- | --- | --- |
| **Raw colour codes in example screens.** On Linux the first card of Lesson 2 shows `notes.txt  ␛[1;34mphotos␛[0m  ␛[1;34mprojects␛[0m`. Bash `ls` emits ANSI colours for folders and the static screen prints them as text. Affects every Linux Learn example and Build/Fill result that lists a folder. macOS and Windows are clean. | `outputLines` in `src/ui/screens/cards.tsx:30` (strip, or turn into coloured spans) | S |
| **Wrong combo line.** At 3 correct in a row Shellby says "4 in a row! Three lessons in a row? Calm down." It reuses the three-lessons lines, and repeats on every answer after that. | `src/ui/screens/Lesson.tsx:92` | S |
| **Welcome line mid-lesson.** "Your turn" challenges have no intro line, so Shellby says "Oh. A visitor. Fine. Let's learn some terminal." at step 8. | `INTRO_LINE` fallback, `src/ui/screens/Lesson.tsx:219` | S |
| **"Total XP" shows the lesson's XP,** not the total. Rename to "XP earned". | `src/ui/screens/LessonComplete.tsx:32` | S |
| **README says "Status: Phase 1 (Linux, Unit 1 Lesson 1)".** Voters open the repo. | `README.md:9` | S |
| **Curiosity costs hearts.** In a "Your turn" challenge, `vim`, `neofetch`, `whoami` or `sudo rm -rf /` each cost a heart, because any failing command does. Builders will try exactly these. Two of them plus one typo restarts the lesson. | `failed` in `src/domain/lessons/runner.ts:72`. Easter eggs and "Hermit doesn't simulate that" should never cost a heart. | S |
| **Phone home screen hides the greeting.** After the auto-scroll to the current node, Shellby's welcome bubble sits under the sticky header. | `scrollIntoView` in `src/ui/screens/Home.tsx:35` | S |

Also worth knowing: the path shows 23 nodes, but 17 are lessons (173 challenges). The last 6 are locked placeholders for Units 6 to 8.

## Recommendations, in priority order

Who it helps: **V** voters (one visit, seconds to impress), **L** learners (coming back).

### Tier 1: before Friday

| # | What | Why | Who | Effort |
| --- | --- | --- | --- | --- |
| 1 | **First keystroke inside 10 seconds.** For a first-time visitor, picking an OS starts Lesson 1 directly, skipping the path and the Start popover. Open Lesson 1 on a real terminal with the prompt's parts labelled (who, which computer, where, your turn) and `pwd` as ghost text, instead of a text-only card over an empty screen. | Today: OS, node, Start, Got it, Got it, then type. The spec asks for playable within 10 seconds. The first card says "This is a terminal" and shows no terminal. | V, L | S for the skip (`onPick` in `src/App.tsx:120`), M with the labelled prompt |
| 2 | **Put the twist on the landing page.** Under the OS buttons, one line that changes as you hover or auto-rotates: "Show hidden files" then `ls -a` (Linux), `ls -a` (macOS), `Get-ChildItem -Force` (Windows), each in its terminal colours. Add the spec's "Switching OS? Try Rosetta mode" link once Rosetta lands. | Hackyard's Remix test is "original recognizable in 10 seconds, twist visible in 30". The landing page today is a logo and three buttons. The twist only appears if you make a cross-OS mistake. | V | M |
| 3 | **"Next lesson" on the complete screen.** Primary button starts the next lesson, with a small "Back to path" link. Keep the streak screen for the first lesson of the day only (already the case). | Chaining a second lesson takes 4 clicks today: Continue, Continue, node, Start. The moment after a win is when people keep going. | V, L | S |
| 4 | **Gentler out-of-hearts.** At 0 hearts, resume at the current challenge with hearts refilled, and drop the lesson's "Flawless" result instead of restarting from step 1. | A full restart after 3 slips is the most likely place a voter closes the tab. The stakes can live in the Flawless badge. This changes a spec rule ("At 0 hearts the lesson restarts"), so it is Robert's call. | V, L | S (`startLesson` calls in `src/domain/lessons/lesson-run.ts:82` and `:105`) |
| 5 | **Let people who know the basics skip ahead.** A "Know this already? Jump here" link on each unit banner. Simple version unlocks the unit. Better version is a 5-question check built from that unit's review challenges. | Voters are builders. Most know `pwd` and `ls`, and today they must clear 8 beginner lessons before they can see pipes, PowerShell objects or the runaway process. The most impressive content is locked away from the people ranking it. Changes progression, so Robert's call. | V | S unlock, M with the check |
| 6 | **Shell collection.** Hermit crabs trade up shells. Finishing a unit gives Shellby a new one (tin can, teacup, conch, old CRT monitor, treasure chest) with its own unit-complete screen, and a small wardrobe on the path to switch between them. Minimum version: just the unit-complete screen with the new shell. | Units end today with the same screen as any lesson. This is a reward loop that belongs to Hermit, is nothing like Duolingo, and is the screenshot voters will remember. | V, L | M (5 shell variants in `src/ui/mascot/Shellby.tsx`, one screen, one saved field) |
| 7 | **Make the link and the result shareable.** Add Open Graph title, description and image so the link unfurls with Shellby in chat. On the complete screen, a "Copy result" button with a short text card, for example `Hermit · Windows · Unit 2 🦀 ✅✅❌✅✅✅ 89% · 4 day streak` plus the link. | `index.html` has no social tags, so the link is a bare URL wherever voters share builds. A copyable result is free word of mouth during ranking. | V | S each |
| 8 | **Secrets counter.** Once the easter eggs land, show "Secrets found 1/6" on the path, with a hint line for one unfound secret. | Hidden eggs only delight the people who stumble on them. A counter tells every voter they exist and gives builders a reason to poke around. Depends on the free-hearts fix above. | V | S |
| 9 | **Give XP a meaning.** Crab ranks on the path header (Hatchling, Tide-pooler, Shell collector, Root crab) with a bar to the next rank, and a small daily goal ring (for example 50 XP) beside the flame. | XP is a number that goes up and does nothing. Ranks and a daily goal turn it into "one more lesson". Local only, no backend. | L, V | M |
| 10 | **Keyboard all the way.** Number keys pick tiles in Build, Fill and Match. Tab completes file names in the terminal (the key is read and ignored today). | The audience lives on the keyboard, and reaching for the mouse in a terminal game breaks the flow. Tab completion is also a real terminal habit worth teaching. | V, L | S for number keys, M for Tab |
| 11 | **Demo video and README.** One-line pitch, a GIF of the wrong-OS roast, the live link. Hackyard cannot rank an entry without the video. | Required, and the GIF is the fastest way to show the twist. | V | M, Robert |

### Tier 2: if Thursday allows

| # | What | Why | Who | Effort |
| --- | --- | --- | --- | --- |
| 12 | **Command collection ("My commands").** Every command you learn is added to a personal cheat sheet, with the same task in the other two shells beside it and a count such as 14/38. | A collection to fill, a reference learners will actually reuse, and a second place the three-shell twist is visible. Pairs naturally with Rosetta. | L, V | M |
| 13 | **Daily drill.** A button on the path that plays 6 review challenges drawn from finished lessons, no Learn cards. Counts for the streak. | Once the 17 lessons are done there is nothing new to do, so the streak has nothing to feed on. PEDAGOGY.md already lists a Practice button under "Could". | L | M |
| 14 | **Shell sprint.** An optional 60-second round: prompts appear, type the command, score and personal best saved. | The beginner lessons are too easy to hold a builder for long. A timed round is the "one more go" mode for exactly the people voting. Optional, so it does not conflict with "no timers" in lessons. | V | M to L |
| 15 | **Burrow map.** The folder tree with a "you are here" marker that moves on `cd`, from PEDAGOGY.md. | Makes the simulated filesystem visible, helps beginners, and looks impressive in the demo. | L, V | M |
| 16 | **Livelier Learn cards.** Type the example out character by character and fill the empty space below the card. | Learn cards are the flattest screens: a paragraph and a large dark void. | L, V | S |
| 17 | **More Shellby.** More lines per event (3 to 5 gets repetitive within two lessons), a few rare ones, mnemonics from PEDAGOGY.md ("pwd is not your password"), and a line for each rank and shell. | Variety is the cheap form of surprise, and Shellby's voice is the personality of the app. | V, L | S, content only |
| 18 | **Streak care.** A "spare shell" that saves one missed day (earned every 5 lessons), and a tab title that changes when the tab is in the background ("Shellby is waiting"). | A streak with no safety net feels punishing the first time it breaks. The tab title is a harmless nudge that needs no permission. | L | S each |
| 19 | **A finale.** When the last lesson is done: a course-complete screen with commands learned, accuracy, days, and a link to the cheat sheet. | Finishing everything today returns you to a path with no glowing node and nothing said. | L | M |

### Tier 3: after the hackathon

Accounts with leagues or friends, push or email reminders, real spaced repetition (the half-life model in PEDAGOGY.md), an installable offline app, a tap-tiles mode for "Your turn" challenges on phones, and Units 6 to 8. All need a backend or more time than is left.

## Decisions for Robert

Three recommendations change rules in the spec or the progression, so they should not be built without a yes:

1. Out-of-hearts resumes at the current challenge instead of restarting the lesson (#4).
2. Unknown and easter-egg commands stop costing hearts (bug table).
3. Skip-ahead for people who know the basics (#5).

## A possible order for the days left

- **Tue:** the bug table, #1 (straight into Lesson 1), #3 (Next lesson), #7 (social tags).
- **Wed:** #2 (landing twist), #4 (hearts), #5 (skip ahead), #10 (number keys).
- **Thu:** #6 (shells), #8 (secrets counter), #9 (ranks), the share button, then Tier 2 in order if time remains.
- **Fri:** freeze, video, README.

## What not to do

- **Leaderboards or anything needing accounts.** A spec non-goal, and empty leaderboards look worse than none.
- **Heart refill timers or waiting.** "No timers, no waiting" is a selling point against the original. Keep it.
- **A notification permission prompt.** Voters will deny it and it reads as pushy.
- **Guilt that stops being a joke.** Shellby's sarcasm works because it is light. `exit` saying "You can't leave. You have a streak." is the right level.
- **Anything that drifts toward the original's look.** The path, hearts, flame and three-stat complete screen already echo it as closely as a remix should. New features (shells, ranks, secrets) should look like Hermit's own.
