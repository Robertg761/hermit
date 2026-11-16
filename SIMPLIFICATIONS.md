# Simplifications

Where Hermit's simulated shells differ from the real thing. Each line is a deliberate shortcut.

## Bash (Linux)

- `ls` prints short listings on one line separated by two spaces instead of fitting real terminal columns.
- `ls -l` shows a fixed owner (`you you`), a fixed date (`Nov 16 18:00`) and a `total` computed from file sizes, not disk blocks.
- `cat -n`, `echo -e` and other flags not in the curriculum are accepted but minimal (`echo -e` does not interpret escapes).
- `cd -` works; `CDPATH` and `pushd`/`popd` are not simulated.
- Background jobs (`&`), subshells, command substitution (`$(...)`) and here-docs are not simulated.
- `mkdir`, `touch`, `rm`, `cp` and `mv` print GNU coreutils wording; BSD (macOS) wording arrives with the zsh dialect.

## zsh (macOS)

- Shares the Bash parser, so zsh-only syntax (extended globs, `**/`, parameter flags) is not simulated. Unmatched globs do error like zsh's default `nomatch`.
- BSD tools print BSD error wording, but `ls -l` uses the same fixed date and sizes as on Linux.
- `open` does nothing visible, `caffeinate` returns immediately, and `sw_vers` reports a made-up version.

## PowerShell 7 (Windows)

- Pipelines carry typed objects (files, paths, strings, numbers), but only the properties the lessons use exist (`Name`, `FullName`, `Length`, `Extension`, `BaseName`, `Path`, `Count`).
- Script blocks (`{ ... }`), `Where-Object`/`ForEach-Object` filters and ordinary `$variables` print a friendly "not simulated yet" message. `$env:` variables, `$HOME`, `$PWD`, `$PROFILE`, `$?`, `$true`, `$false` and `$null` work.
- `Get-ChildItem` tables use a fixed date for every item.
- `Remove-Item` on a folder with children errors instead of showing the confirmation prompt, because Hermit can't ask follow-up questions.
- Native Windows programs (`find.exe`, `where.exe`, `sudo`) are reported as not recognized instead of running with their own errors.
- `-ErrorAction`, `-Verbose` and other common parameters are not bound.

## Wrong-OS explanations

- Explanations are matched by pattern on lines that failed, so a habit that happens to succeed (like `ls` in PowerShell, which is an alias) stays silent.

## Units 3 to 5 tools

- `grep` uses basic regular expressions translated to JavaScript ones; `-E`, `-P`, context flags (`-A`, `-B`, `-C`) and colour highlighting are not simulated.
- `find` supports `-name`, `-iname`, `-type f|d` and `-print` only, and lists results sorted by name rather than in directory order.
- `tail -f` prints the last lines and returns instead of following the file.
- `ps` shows a fixed-format table with made-up memory and time columns. Only the PID, %CPU and command are meaningful.
- `kill` accepts signal flags (`-9`, `-KILL`) but every signal simply ends the process.
- `sudo` never asks for a password.
- Scripts run line by line through the same simulated shell. Variables, functions, loops and `if` inside scripts are not simulated.
- PowerShell `Where-Object` and `ForEach-Object` understand the simplified syntax (`Where-Object Name -like "*.txt"`) and one-comparison script blocks (`{ $_.Length -gt 100 }`). Anything longer prints a friendly "not simulated" message.
- `Start-Process pwsh -Verb RunAs` skips the real UAC dialog and simply makes the session an administrator one.
