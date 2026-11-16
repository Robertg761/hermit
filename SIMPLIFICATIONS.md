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
