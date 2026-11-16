import type { SeedState } from '../../domain/machine';
import { same, type Lesson, type PerOs, type Unit } from '../../domain/lessons/types';
import { predict } from '../builders';

/** Shellby's workshop: a home folder that needs tidying. */
const workshop: SeedState = {
  files: {
    'recipe.txt': 'Kelp chips\n1. Find kelp.\n2. Dry kelp.\n3. Crunch.\n',
    'draft.txt': 'Dear diary, today I found a bigger shell.\n',
    'old-name.txt': 'Rename me.\n',
    'junk.txt': 'nobody needs this\n',
    'important.txt': 'Do not delete. This is my shell insurance.\n',
    'src/app.js': 'console.log("hi")\n',
    'src/util.js': 'export const add = (a, b) => a + b;\n',
    'junk/old1.tmp': '',
    'junk/old2.tmp': '',
  },
  dirs: ['archive'],
};

const seed = (cwd?: string): PerOs<SeedState> => {
  const s = cwd === undefined ? workshop : { ...workshop, cwd };
  return same(s);
};

const posixAndWindows = <T>(posix: T, windows: T): PerOs<T> => ({ linux: posix, mac: posix, windows });

export const unit2Lesson1: Lesson = {
  id: 'u2-l1',
  title: 'Make things',
  challenges: [
    {
      id: 'u2-l1-c1',
      type: 'do',
      prompt: same('Make a new folder called notes.'),
      seed: seed(),
      goal: same({ kind: 'exists', path: 'notes', type: 'dir' }),
      solutions: posixAndWindows([['mkdir notes']], [['New-Item -ItemType Directory notes'], ['mkdir notes']]),
      hints: posixAndWindows(
        ['The command is short for "make directory".', 'Type `mkdir notes`.'],
        ['You want a *new item* whose *type* is Directory. `mkdir` also works.', 'Type `New-Item -ItemType Directory notes` (or `mkdir notes`).'],
      ),
      explain: posixAndWindows(
        '`mkdir` makes a directory (a folder). `mkdir -p a/b/c` makes the whole chain at once.',
        '`New-Item -ItemType Directory` creates a folder. PowerShell also ships a `mkdir` shortcut for it.',
      ),
    },
    {
      id: 'u2-l1-c2',
      type: 'do',
      prompt: same('Create an empty file called todo.txt.'),
      seed: seed(),
      goal: same({ kind: 'exists', path: 'todo.txt', type: 'file' }),
      solutions: posixAndWindows([['touch todo.txt']], [['New-Item todo.txt'], ['ni todo.txt']]),
      hints: posixAndWindows(
        ['This command *touches* a file, creating it if it does not exist.', 'Type `touch todo.txt`.'],
        ['There is no `touch` in PowerShell. Make a *new item* instead.', 'Type `New-Item todo.txt`.'],
      ),
      explain: posixAndWindows(
        '`touch` creates an empty file, or updates the date on one that already exists.',
        '`New-Item` creates a file by default. `touch` is a Linux and macOS habit that PowerShell does not have.',
      ),
    },
    {
      id: 'u2-l1-c3',
      type: 'do',
      prompt: same('Shellby left a recipe in recipe.txt. Print what is inside it.'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'Kelp chips' }),
      solutions: posixAndWindows([['cat recipe.txt']], [['Get-Content recipe.txt'], ['cat recipe.txt'], ['type recipe.txt']]),
      hints: posixAndWindows(
        ['The command is short for "concatenate", and it prints files.', 'Type `cat recipe.txt`.'],
        ['You want to *get* the *content* of the file.', 'Type `Get-Content recipe.txt` (aliases: `cat`, `type`).'],
      ),
      explain: posixAndWindows(
        '`cat` prints a file. Give it several files and it prints them one after another.',
        '`Get-Content` reads a file line by line. `cat` and `type` are aliases for it.',
      ),
    },
    predict({
      id: 'u2-l1-c4',
      prompt: same('Shellby runs these two lines. What does the second one print?'),
      seed: seed(),
      command: posixAndWindows(['mkdir archive/2026', 'ls archive'], ['mkdir archive\\2026', '(Get-ChildItem archive).Name']),
      options: posixAndWindows(['archive', '2026', 'archive/2026'], ['archive', '2026', 'archive\\2026']),
      answer: same(1),
      hints: same(['Listing a folder shows what is *inside* it.']),
      explain: same('Listing a folder shows its contents, so you see the new folder 2026 by itself.'),
    }),
    {
      id: 'u2-l1-c5',
      type: 'fix',
      prompt: same('Shellby wants ONE file called "shopping list.txt", with a space in the name. This command gets it wrong. Fix it.'),
      seed: seed(),
      prefill: posixAndWindows('touch shopping list.txt', 'New-Item shopping list.txt'),
      goal: same({ kind: 'exists', path: 'shopping list.txt', type: 'file' }),
      solutions: posixAndWindows(
        [['touch "shopping list.txt"'], ["touch 'shopping list.txt'"], ['touch shopping\\ list.txt']],
        [['New-Item "shopping list.txt"'], ["New-Item 'shopping list.txt'"]],
      ),
      hints: posixAndWindows(
        ['Spaces split arguments. As written, this makes two files: shopping and list.txt.', 'Wrap the name in quotes: `touch "shopping list.txt"`.'],
        ['Spaces split arguments, so PowerShell sees two names.', 'Wrap the name in quotes: `New-Item "shopping list.txt"`.'],
      ),
      explain: same('Quotes keep a name with spaces together as one argument. Single or double quotes both work here.'),
    },
  ],
};

export const unit2Lesson2: Lesson = {
  id: 'u2-l2',
  title: 'Copy, move, delete',
  challenges: [
    {
      id: 'u2-l2-c1',
      type: 'do',
      prompt: same('Make a backup copy of draft.txt called draft-backup.txt.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'fileContains', path: 'draft-backup.txt', text: 'bigger shell' }, { kind: 'exists', path: 'draft.txt' }] }),
      solutions: posixAndWindows([['cp draft.txt draft-backup.txt']], [['Copy-Item draft.txt draft-backup.txt'], ['cp draft.txt draft-backup.txt'], ['copy draft.txt draft-backup.txt']]),
      hints: posixAndWindows(
        ['The copy command is just two letters: source first, then destination.', 'Type `cp draft.txt draft-backup.txt`.'],
        ['You want to *copy* an *item*: source first, then destination.', 'Type `Copy-Item draft.txt draft-backup.txt`.'],
      ),
      explain: posixAndWindows('`cp source destination` copies a file and leaves the original alone.', '`Copy-Item source destination` copies a file. `cp` and `copy` are aliases.'),
    },
    {
      id: 'u2-l2-c2',
      type: 'do',
      prompt: same('Copy the whole src folder, with everything in it, to a new folder called backup.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'exists', path: 'backup/app.js', type: 'file' }, { kind: 'exists', path: 'backup/util.js', type: 'file' }, { kind: 'exists', path: 'src/app.js' }] }),
      solutions: posixAndWindows([['cp -r src backup'], ['cp -R src backup']], [['Copy-Item src backup -Recurse'], ['cp src backup -Recurse'], ['Copy-Item -Recurse src backup']]),
      hints: posixAndWindows(
        ['Copying a folder needs a flag that means "recursive".', 'Type `cp -r src backup`.'],
        ['Copying a folder and its contents needs the `-Recurse` switch.', 'Type `Copy-Item src backup -Recurse`.'],
      ),
      explain: posixAndWindows('`-r` makes `cp` copy folders and everything inside them.', 'Without `-Recurse`, Copy-Item copies only the empty folder. With it, everything inside comes along.'),
    },
    {
      id: 'u2-l2-c3',
      type: 'do',
      prompt: same('Rename old-name.txt to new-name.txt.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'exists', path: 'new-name.txt', type: 'file' }, { kind: 'notExists', path: 'old-name.txt' }] }),
      solutions: posixAndWindows([['mv old-name.txt new-name.txt']], [['Rename-Item old-name.txt new-name.txt'], ['Move-Item old-name.txt new-name.txt'], ['mv old-name.txt new-name.txt']]),
      hints: posixAndWindows(
        ['There is no rename command. Renaming is just *moving* a file to a new name.', 'Type `mv old-name.txt new-name.txt`.'],
        ['PowerShell has a cmdlet that *renames* an *item*.', 'Type `Rename-Item old-name.txt new-name.txt`.'],
      ),
      explain: posixAndWindows('`mv` moves files, and moving to a new name in the same folder is a rename.', '`Rename-Item` renames in place. `Move-Item` (alias `mv`) can rename and move.'),
    },
    {
      id: 'u2-l2-c4',
      type: 'do',
      prompt: same('Delete junk.txt. Leave important.txt alone!'),
      seed: seed(),
      protectedPaths: ['important.txt'],
      goal: same({ kind: 'notExists', path: 'junk.txt' }),
      solutions: posixAndWindows([['rm junk.txt']], [['Remove-Item junk.txt'], ['rm junk.txt'], ['del junk.txt']]),
      hints: posixAndWindows(
        ['The remove command is two letters.', 'Type `rm junk.txt`.'],
        ['You want to *remove* an *item*.', 'Type `Remove-Item junk.txt` (aliases: `rm`, `del`).'],
      ),
      explain: posixAndWindows(
        '`rm` deletes for real: there is no recycle bin in the terminal, so double-check names.',
        '`Remove-Item` deletes for real, with no Recycle Bin. Double-check names before pressing Enter.',
      ),
    },
    {
      id: 'u2-l2-c5',
      type: 'fix',
      prompt: same('Shellby wants the junk folder and everything in it gone. This command fails. Fix it.'),
      seed: seed(),
      protectedPaths: ['important.txt'],
      prefill: posixAndWindows('rm junk', 'rm -rf junk'),
      goal: same({ kind: 'notExists', path: 'junk' }),
      solutions: posixAndWindows([['rm -r junk'], ['rm -rf junk']], [['Remove-Item junk -Recurse -Force'], ['Remove-Item junk -Recurse'], ['rm junk -Recurse']]),
      hints: posixAndWindows(
        ['`rm` refuses to delete folders unless you say to go *recursively* through them.', 'Type `rm -r junk`.'],
        ['`-rf` is Linux talk. PowerShell spells it out with full parameter names.', 'Type `Remove-Item junk -Recurse -Force`.'],
      ),
      explain: posixAndWindows(
        '`rm -r` deletes a folder and its contents. Add `-f` to skip prompts and missing-file errors.',
        'PowerShell uses `-Recurse` and `-Force` instead of `-rf`. The `rm` alias works, but its parameters are still PowerShell ones.',
      ),
    },
    predict({
      id: 'u2-l2-c6',
      prompt: same('After these lines, what does the last one print?'),
      seed: seed(),
      command: posixAndWindows(['mv draft.txt archive', 'ls archive'], ['Move-Item draft.txt archive', '(Get-ChildItem archive).Name']),
      options: same(['archive', 'draft.txt', 'archive/draft.txt']),
      answer: same(1),
      hints: same(['Moving a file *into* an existing folder keeps its name.']),
      explain: same('When the destination is an existing folder, the file moves inside it with the same name.'),
    }),
  ],
};

export const unit2: Unit = {
  id: 'u2',
  title: 'Files and folders',
  blurb: 'Make, read, copy, move and delete files.',
  lessons: [unit2Lesson1, unit2Lesson2],
};
