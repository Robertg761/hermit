import type { OS } from '../types';

/**
 * Habits from one OS's shell typed into another. When a line fails and matches
 * one of these, Hermit explains the local way instead of leaving a bare error.
 */
export type WrongOsRule = {
  /** The shells where this habit fails. */
  readonly on: readonly OS[];
  readonly test: RegExp;
  readonly explain: string;
  /** Lines that must trigger the rule (checked by tests). */
  readonly examples: readonly string[];
};

const POSIX: readonly OS[] = ['linux', 'mac'];
const WIN: readonly OS[] = ['windows'];

/** Match a command name at the start of any statement in the line. */
const cmd = (names: string, rest = ''): RegExp => new RegExp(`(?:^|[;|&(]\\s*)(?:${names})(?=\\s|$)${rest}`, 'i');

export const wrongOsRules: readonly WrongOsRule[] = [
  // ---- Linux / macOS habits on Windows PowerShell ----
  {
    on: WIN,
    test: cmd('rm|del|Remove-Item', '.*\\s-(?:rf|fr|Rf|rF)\\b'),
    explain: "That's the Linux and macOS way. PowerShell spells it out: `Remove-Item junk -Recurse -Force` (or `rm junk -r -fo`). Single-letter flags can't be glued together here.",
    examples: ['rm -rf junk', 'rm -fr junk'],
  },
  {
    on: WIN,
    test: cmd('ls|dir|gci|Get-ChildItem', '\\s+-(?:la|al|l|a|lah|lh|A)(?=\\s|$)'),
    explain: 'That flag comes from Linux `ls`. In PowerShell, `Get-ChildItem` already shows the long listing, and `-Force` shows hidden files.',
    examples: ['ls -la', 'ls -l', 'ls -a', 'dir -al'],
  },
  {
    on: WIN,
    test: cmd('ls|dir|gci', '\\s+-R(?=\\s|$)'),
    explain: 'PowerShell has no `-R`. Use `Get-ChildItem -Recurse` to look inside every folder.',
    examples: ['ls -R'],
  },
  {
    on: WIN,
    test: cmd('touch'),
    explain: 'Windows has no `touch`. Make an empty file with `New-Item name.txt`.',
    examples: ['touch notes.txt'],
  },
  {
    on: WIN,
    test: cmd('cat|gc|type|Get-Content', '\\s+-n\\b'),
    explain: "`cat -n` numbers lines on Linux and macOS. PowerShell's `Get-Content` has no line numbers; it just prints the lines.",
    examples: ['cat -n notes.txt'],
  },
  {
    on: WIN,
    test: cmd('head|tail'),
    explain: 'No `head` or `tail` here. Use `Get-Content file -Head 5` or `Get-Content file -Tail 5` (add `-Wait` to follow a log like `tail -f`).',
    examples: ['head -n 5 notes.txt', 'tail -f log.txt'],
  },
  {
    on: WIN,
    test: cmd('grep'),
    explain: "PowerShell's grep is `Select-String`: `Select-String pattern file.txt`, or pipe into it.",
    examples: ['grep hello notes.txt'],
  },
  {
    on: WIN,
    test: cmd('which'),
    explain: 'To find where a command lives, PowerShell uses `Get-Command name`.',
    examples: ['which python'],
  },
  {
    on: WIN,
    test: cmd('export'),
    explain: 'Environment variables look different here: `$env:NAME = "value"`.',
    examples: ['export NAME=shellby'],
  },
  {
    on: WIN,
    test: cmd('chmod|chown'),
    explain: "Windows doesn't use `chmod`. Files aren't marked executable; PowerShell scripts end in `.ps1` and the execution policy decides what may run.",
    examples: ['chmod +x run.sh'],
  },
  {
    on: WIN,
    test: cmd('sudo'),
    explain: "PowerShell doesn't use `sudo`. Open a new terminal with \"Run as administrator\" instead.",
    examples: ['sudo rm notes.txt'],
  },
  {
    on: WIN,
    test: cmd('wc'),
    explain: 'Count lines with `Get-Content file | Measure-Object -Line`.',
    examples: ['wc -l notes.txt'],
  },
  {
    on: WIN,
    test: cmd('find', '\\s+\\S+\\s+-name'),
    explain: 'Search by name with `Get-ChildItem -Recurse -Filter "*.txt"`.',
    examples: ['find . -name notes.txt'],
  },
  {
    on: WIN,
    test: cmd('apt|apt-get|brew'),
    explain: 'Windows installs software with `winget install name`.',
    examples: ['apt install git', 'brew install git'],
  },
  {
    on: WIN,
    test: cmd('open'),
    explain: '`open` is a Mac thing. PowerShell opens files and folders with `Invoke-Item` (or `ii .` for the current folder).',
    examples: ['open .'],
  },
  {
    on: WIN,
    test: cmd('pbcopy|pbpaste'),
    explain: 'The Windows clipboard commands are `Set-Clipboard` and `Get-Clipboard`.',
    examples: ['echo hi | pbcopy'],
  },
  {
    on: WIN,
    test: cmd('nano|vim|vi'),
    explain: 'No terminal editor here by default. Try `notepad file.txt`.',
    examples: ['nano notes.txt'],
  },
  {
    on: WIN,
    test: cmd('kill|ps', '\\s+-?(?:9|aux|ef)\\b'),
    explain: 'In PowerShell, `ps` is `Get-Process` and `kill` is `Stop-Process`, with PowerShell parameters: `Stop-Process -Id 4242 -Force`.',
    examples: ['kill -9 4242', 'ps aux'],
  },
  {
    on: WIN,
    test: /(?:^|[;|&]\s*)\.\/\S+\.sh(?=\s|$)/,
    explain: '`.sh` scripts are for bash. PowerShell scripts end in `.ps1` and run like `.\\build.ps1`.',
    examples: ['./build.sh'],
  },
  // ---- Windows habits on Linux / macOS ----
  {
    on: POSIX,
    test: cmd('Get-ChildItem|gci'),
    explain: 'That is PowerShell. On Linux and macOS, list a folder with `ls` (`ls -a` for hidden files).',
    examples: ['Get-ChildItem'],
  },
  {
    on: ['mac'],
    test: cmd('dir'),
    explain: '`dir` is the Windows habit. Here it is `ls`.',
    examples: ['dir'],
  },
  {
    on: POSIX,
    test: cmd('cls'),
    explain: '`cls` is Windows. Here it is `clear` (or press Ctrl+L).',
    examples: ['cls'],
  },
  {
    on: POSIX,
    test: cmd('Get-Content|type|gc'),
    explain: 'To print a file here, use `cat file.txt`.',
    examples: ['Get-Content notes.txt', 'type notes.txt'],
  },
  {
    on: POSIX,
    test: cmd('New-Item|ni'),
    explain: 'Here, `touch name.txt` makes a file and `mkdir name` makes a folder.',
    examples: ['New-Item notes.txt'],
  },
  {
    on: POSIX,
    test: cmd('Remove-Item|del|erase|rd'),
    explain: 'Delete with `rm file`, and `rm -r folder` for a folder. There is no recycle bin in the terminal.',
    examples: ['Remove-Item notes.txt', 'del notes.txt'],
  },
  {
    on: POSIX,
    test: cmd('Copy-Item|copy'),
    explain: 'Copy with `cp from to`, and `cp -r` for folders.',
    examples: ['Copy-Item a.txt b.txt', 'copy a.txt b.txt'],
  },
  {
    on: POSIX,
    test: cmd('Move-Item|move|ren|Rename-Item'),
    explain: 'Here one command moves and renames: `mv old new`.',
    examples: ['Move-Item a.txt b', 'ren a.txt b.txt'],
  },
  {
    on: POSIX,
    test: cmd('Set-Location|sl'),
    explain: 'Change folders with `cd`.',
    examples: ['Set-Location projects'],
  },
  {
    on: POSIX,
    test: cmd('Get-Location|gl'),
    explain: 'Print where you are with `pwd`.',
    examples: ['Get-Location'],
  },
  {
    on: POSIX,
    test: cmd('cd\\.\\.|cd\\\\'),
    explain: 'Bash and zsh need a space: `cd ..` (and `cd /` for the top).',
    examples: ['cd..'],
  },
  {
    on: POSIX,
    test: /(?:^|[;|&]\s*)(?:cd|ls|cat|rm|cp|mv|mkdir|touch)\s+[^|;&]*\w\\\w/,
    explain: 'Linux and macOS separate folders with `/`, not `\\`. A backslash here means "treat the next character literally", so `projects\\game` became `projectsgame`.',
    examples: ['cd projects\\game'],
  },
  {
    on: POSIX,
    test: cmd('Write-Host|Write-Output'),
    explain: 'Print text with `echo "hello"`.',
    examples: ['Write-Host hello'],
  },
  {
    on: POSIX,
    test: /(?:^|[;|&]\s*)\$env:/i,
    explain: 'That is PowerShell syntax. Here, set a variable with `export NAME=value` and read it with `$NAME`.',
    examples: ['$env:NAME = "shellby"'],
  },
  {
    on: POSIX,
    test: cmd('ipconfig'),
    explain: 'On Linux try `ip addr`; on macOS, `ifconfig`.',
    examples: ['ipconfig'],
  },
  {
    on: POSIX,
    test: cmd('tasklist|taskkill|Get-Process|Stop-Process'),
    explain: 'List programs with `ps` and stop one with `kill <pid>`.',
    examples: ['tasklist', 'Get-Process'],
  },
  {
    on: POSIX,
    test: cmd('Select-String|findstr'),
    explain: 'Search text with `grep pattern file`.',
    examples: ['findstr hello notes.txt', 'Select-String hello notes.txt'],
  },
  {
    on: POSIX,
    test: cmd('winget|choco'),
    explain: 'Linux installs with `sudo apt install name`; macOS usually uses `brew install name`.',
    examples: ['winget install git'],
  },
  {
    on: POSIX,
    test: /(?:^|[;|&]\s*)\.\\/,
    explain: 'That backslash is the Windows way. Here, run a script from this folder with `./build.sh`.',
    examples: ['.\\build.ps1'],
  },
  // ---- Linux and macOS differences ----
  {
    on: ['linux'],
    test: cmd('pbcopy|pbpaste|say|open|sw_vers|caffeinate'),
    explain: 'That one is macOS-only. Linux has its own versions, such as `xdg-open` instead of `open`.',
    examples: ['open .', 'say hello'],
  },
  {
    on: ['linux'],
    test: cmd('brew'),
    explain: 'Homebrew is the macOS habit. On Ubuntu-style Linux, install with `sudo apt install name`.',
    examples: ['brew install git'],
  },
  {
    on: ['mac'],
    test: cmd('apt|apt-get|xdg-open'),
    explain: 'That is Linux. macOS uses `brew install name`, and `open` to open files.',
    examples: ['apt install git', 'xdg-open .'],
  },
];

/** Explain a failed line if it looks like another OS's habit. */
export const explainWrongOs = (os: OS, line: string): string | undefined =>
  wrongOsRules.find((r) => r.on.includes(os) && r.test.test(line.trim()))?.explain;
