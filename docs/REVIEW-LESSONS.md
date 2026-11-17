# Lesson review: every lesson, every OS

Nov 17, 2026. Robert asked for every lesson to be checked so it works, reads well, makes sense and is easy for a total beginner, plus at least 5 other big areas to improve.

## How this was done

- **One reviewer per unit** read every challenge on Linux, macOS and Windows against `docs/PEDAGOGY.md`, using transcripts that show each lesson exactly as the learner meets it, with real engine output. Together they ran about 950 alternative answers through the engine (other flags, aliases, paths, orderings) to check that reasonable right answers pass and wrong ones fail, and played parts of each unit in the browser on desktop and a 390px phone.
- **A bot played all 17 lessons through the real UI** on all three OSes, at desktop and phone sizes, plus unhappy paths (wrong answers, hints, out of hearts, second tries). Final run: 75 of 75 lesson runs complete, 0 console errors, 0 sideways scroll.
- **A scout** played the app as a beginner, ran an accessibility check, probed 54 typical beginner mistakes, and compared the app with what PEDAGOGY.md promised.

## Lesson fixes (all five units)

The main kinds of problem, with examples:

- **Wrong answers that passed.** On Windows, `ls` passed "find out where you are" because its `Directory:` header contains the path. `ls | wc -l` passed "how many ERROR lines" because the counts happened to match. `cat server.log` passed "show the line with 12" because `08:12` contains 12. `mv important.txt backup.txt` passed "back up the file" while destroying it. `tail -n 2` passed "only the last line". All fixed by tighter goals or protected files.
- **Words used before they were taught.** cmdlet, directory, destination, signal, CPU, root, shell, `;`, `&&`, `||`, `sudo` and `(Get-ChildItem).Name` all showed up in prompts, options or hints before any card explained them.
- **First Do without a visible hint.** PEDAGOGY says the first free-typing challenge for each new skill shows its hint. About 12 did not.
- **OS facts.** Linux had an `open` option (that is macOS). Cards said "Recycle Bin" on Mac and "Finder" on Windows. PowerShell 7 does not block local scripts by default, so the Windows script lesson now frames it as "some computers block scripts". `uniq -c` was explained backwards. Measure-Object prints a table, not a number.
- **Missing practice.** `mv` and `wc` were taught but never typed from scratch; each now has a Do. Two "review" challenges were copies of the challenge before them.
- **Plain wording.** Tilde named and located on the keyboard, `.` and `..` explained where they first appear, "output" and "objects" defined in the pipes unit, `-Force` no longer described as "skips questions".

## Engine and UI bugs fixed

- Phone: long commands that wrapped stacked a copy of the prompt on every keystroke. The result sheet made every phone page scroll sideways by 12px. Short commands broke at the hyphen (`Select-` / `String`).
- Real commands that failed: `cp -a`, `killall`, `chmod u=rwx`, `tail -n +11`, `grep -I`, `echo $PWD`, `Out-File`, `gci -r`, `cd..` and `sl` in PowerShell, `Get-ChildItem *.txt -Recurse`, `-Name` with `-Recurse`.

## Improvements built

1. **Friendlier errors.** Real commands Hermit doesn't simulate (`man`, `history`, `apt`, `brew`, `winget`, `Get-History`, `--help` and about 125 more) now say what they do on a real computer and never cost a heart. New plain-English lines for: missing names after `cp`/`mv`/`mkdir`, an unclosed quote, a space splitting a file name, capital letters in commands, scripts run without `./`, Permission denied, and disabled PowerShell scripts.
2. **Burrow map.** A folder tree beside the terminal with Herme marking where you are, updating after every `cd`. Folders only, so it never gives away what `ls` would show. Open by default in Units 1 and 2 on desktop, a one-line "you are here" on phones.
3. **Tab completion.** Tab finishes file, folder and command names like a real shell; a second Tab lists the matches. Esc leaves the terminal so keyboard users can reach Hint and Leave.
4. **Lesson recap and "Try it on your computer".** The complete screen lists what the lesson taught and how to open a real terminal on your OS, with the lesson's look-only commands to try.
5. **Accessibility.** Screen reader mode for the terminal, a name for the progress bar, unit names on the Skip ahead buttons.
6. **Safer secret hint.** "Try the most famous terrible command" now adds "only here, never on a real computer".

## Calls for Robert

These change the spec or the game rules, so they were not built:

1. **A "Terminal superpowers" lesson** (Tab, up arrow for history, Ctrl+C, `clear`, getting help) at the end of Unit 1. No unit teaches these, and they are what make a real terminal bearable. Adds one lesson.
2. **Spaced-repetition Practice:** a button that replays 6 to 8 challenges from your weakest skills. Should it count for the streak and XP?
3. **Capstones show the hint from the start,** because PEDAGOGY says the first Do for a skill does. Should capstones be exempt?
4. **Windows script lesson:** the simulator says PowerShell 7 but starts with scripts blocked, which is really Windows PowerShell 5.1 behaviour. Keep (most beginners hit this error in the built-in PowerShell), or switch the default and reframe the lesson?
5. **Missing capstones:** Unit 3 Lessons 1 and 2 and Unit 4 Lesson 1 end without a challenge that mixes the new skill with an old one. Adding them makes those lessons 11 challenges.
6. **Second tries after running out of hearts:** a challenge restarted after hearts run out does not come back as a "Second try", and counts as clean if you then get it right.

## Still open (smaller)

- A symbol key bar above the phone keyboard (`-`, `/`, `~`, `|`, `>`, `\`, Tab, ↑).
- A per-unit cheat sheet built from the Learn cards.
- Engine accuracy nits: macOS error wording copies Linux in a few places, `ps -ef` prints the `aux` layout, PowerShell `Measure-Object` lacks the StandardDeviation row.
