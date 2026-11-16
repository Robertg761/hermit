import type { SeedState } from '../../domain/machine';
import { same, type Lesson, type PerOs, type Unit } from '../../domain/lessons/types';

/** The learner's home folder in Unit 1: a small, lived-in burrow. */
const burrow = (os: 'posix' | 'windows'): SeedState => ({
  files: {
    'notes.txt': 'Buy more shells.\nFind a bigger shell.\n',
    'projects/website/index.html': '<h1>My shell</h1>\n',
    'projects/website/style.css': 'h1 { color: coral; }\n',
    'projects/game/main.py': 'print("crab rave")\n',
    'photos/beach.jpg': 'JPEG',
    'photos/tidepool.jpg': 'JPEG',
    ...(os === 'posix' ? { '.shellby-secret': 'I was a snail once.\n' } : { 'shellby-secret.txt': 'I was a snail once.\n' }),
  },
  ...(os === 'windows' ? { hidden: ['shellby-secret.txt'] } : {}),
});

const seedAt = (cwd?: string): PerOs<SeedState> => {
  const at = (s: SeedState): SeedState => (cwd === undefined ? s : { ...s, cwd });
  return { linux: at(burrow('posix')), mac: at(burrow('posix')), windows: at(burrow('windows')) };
};

export const unit1Lesson1: Lesson = {
  id: 'u1-l1',
  title: 'Where am I?',
  challenges: [
    {
      id: 'u1-l1-c1',
      type: 'do',
      prompt: same('You just woke up in a terminal. Print the full path of the folder you are standing in.'),
      seed: seedAt(),
      goal: {
        linux: { kind: 'stdoutIncludes', text: '/home/you' },
        mac: { kind: 'stdoutIncludes', text: '/Users/you' },
        windows: { kind: 'stdoutIncludes', text: 'C:\\Users\\you' },
      },
      solutions: { linux: [['pwd']], mac: [['pwd']], windows: [['Get-Location'], ['pwd']] },
      hints: {
        linux: ['The command stands for "print working directory".', 'Type `pwd`.'],
        mac: ['The command stands for "print working directory".', 'Type `pwd`.'],
        windows: ['PowerShell cmdlets are Verb-Noun. You want to *get* your *location*.', 'Type `Get-Location` (or its alias `pwd`).'],
      },
      explain: {
        linux: '`pwd` prints the working directory. On Linux your home folder lives at /home/you.',
        mac: '`pwd` prints the working directory. On macOS your home folder lives at /Users/you.',
        windows: '`Get-Location` returns your current path. `pwd` is a built-in alias for it. Your home is C:\\Users\\you.',
      },
    },
    {
      id: 'u1-l1-c2',
      type: 'do',
      prompt: same('Show what is in this folder.'),
      seed: seedAt(),
      goal: same({ kind: 'stdoutIncludes', text: 'projects' }),
      solutions: { linux: [['ls']], mac: [['ls']], windows: [['Get-ChildItem'], ['ls'], ['dir']] },
      hints: {
        linux: ['It is a two-letter command, short for "list".', 'Type `ls`.'],
        mac: ['It is a two-letter command, short for "list".', 'Type `ls`.'],
        windows: ['You want to *get* the *child items* of this folder.', 'Type `Get-ChildItem` (aliases: `ls`, `dir`).'],
      },
      explain: {
        linux: '`ls` lists the files and folders where you are. Folders show up in blue.',
        mac: '`ls` lists the files and folders where you are.',
        windows: '`Get-ChildItem` lists what is in a folder. `ls` and `dir` are aliases, so habits from other shells still work.',
      },
    },
    {
      id: 'u1-l1-c3',
      type: 'do',
      prompt: same('Shellby swears there is a secret file in here that a plain listing hides. Reveal it.'),
      seed: seedAt(),
      goal: {
        linux: { kind: 'stdoutIncludes', text: '.shellby-secret' },
        mac: { kind: 'stdoutIncludes', text: '.shellby-secret' },
        windows: { kind: 'stdoutIncludes', text: 'shellby-secret.txt' },
      },
      solutions: {
        linux: [['ls -a'], ['ls -la'], ['ls -A']],
        mac: [['ls -a'], ['ls -la'], ['ls -A']],
        windows: [['Get-ChildItem -Force'], ['ls -Force'], ['dir -Force']],
      },
      hints: {
        linux: ['Files whose names start with a dot are hidden. `ls` has a flag for *all* files.', 'Type `ls -a`.'],
        mac: ['Files whose names start with a dot are hidden. `ls` has a flag for *all* files.', 'Type `ls -a`.'],
        windows: ['Windows hides files with a hidden attribute. Get-ChildItem needs to be *forced* to show them.', 'Type `Get-ChildItem -Force`.'],
      },
      explain: {
        linux: 'On Linux any name starting with `.` is hidden. `ls -a` shows all of them, including `.` (here) and `..` (the parent).',
        mac: 'On macOS any name starting with `.` is hidden. `ls -a` shows all of them, including `.` (here) and `..` (the parent).',
        windows: 'Windows hides files by attribute, not by name. `-Force` makes Get-ChildItem include hidden and system files.',
      },
    },
    {
      id: 'u1-l1-c4',
      type: 'do',
      prompt: same('List this folder again, but with details: permissions, sizes and dates.'),
      seed: seedAt(),
      goal: {
        linux: { kind: 'stdoutIncludes', text: 'rw-r--r--' },
        mac: { kind: 'stdoutIncludes', text: 'rw-r--r--' },
        windows: { kind: 'stdoutIncludes', text: 'LastWriteTime' },
      },
      solutions: {
        linux: [['ls -l'], ['ls -la']],
        mac: [['ls -l'], ['ls -la']],
        windows: [['Get-ChildItem'], ['dir']],
      },
      hints: {
        linux: ['`ls` has a flag for the *long* format.', 'Type `ls -l`.'],
        mac: ['`ls` has a flag for the *long* format.', 'Type `ls -l`.'],
        windows: ['In PowerShell, the plain listing already shows details.', 'Type `Get-ChildItem`.'],
      },
      explain: {
        linux: '`ls -l` shows permissions, owner, size and modified date. You can combine flags: `ls -la`.',
        mac: '`ls -l` shows permissions, owner, size and modified date. You can combine flags: `ls -la`.',
        windows: 'Get-ChildItem returns objects with Mode, LastWriteTime, Length and Name, so details come for free.',
      },
    },
    {
      id: 'u1-l1-c5',
      type: 'do',
      prompt: same('Step inside the projects folder.'),
      seed: seedAt(),
      goal: same({ kind: 'cwdIs', path: 'projects' }),
      solutions: {
        linux: [['cd projects']],
        mac: [['cd projects']],
        windows: [['Set-Location projects'], ['cd projects']],
      },
      hints: {
        linux: ['You want to *change directory*.', 'Type `cd projects`.'],
        mac: ['You want to *change directory*.', 'Type `cd projects`.'],
        windows: ['You want to *set* your *location*.', 'Type `Set-Location projects` (alias `cd`).'],
      },
      explain: {
        linux: '`cd` changes directory. Notice the prompt now shows `~/projects`.',
        mac: '`cd` changes directory. Notice the prompt now shows `projects`.',
        windows: '`Set-Location` changes your folder, and `cd` is its alias. Notice the prompt changed.',
      },
    },
    {
      id: 'u1-l1-c6',
      type: 'do',
      prompt: same('You wandered deep into projects/website. Head back to your home folder.'),
      seed: seedAt('projects/website'),
      goal: same({ kind: 'cwdIs', path: '' }),
      solutions: {
        linux: [['cd ~'], ['cd'], ['cd ../..']],
        mac: [['cd ~'], ['cd'], ['cd ../..']],
        windows: [['cd ~'], ['Set-Location ~'], ['cd ..\\..']],
      },
      hints: {
        linux: ['`..` means "one folder up", and `~` means "home".', 'Type `cd ~` (or `cd ..` twice).'],
        mac: ['`..` means "one folder up", and `~` means "home".', 'Type `cd ~` (or `cd ..` twice).'],
        windows: ['`..` means "one folder up", and `~` means "home" in PowerShell too.', 'Type `cd ~` (or `cd ..` twice).'],
      },
      explain: {
        linux: '`cd ..` goes up one level and `cd ~` (or plain `cd`) jumps straight home.',
        mac: '`cd ..` goes up one level and `cd ~` (or plain `cd`) jumps straight home.',
        windows: '`cd ..` goes up one level and `cd ~` jumps home. PowerShell accepts both `\\` and `/` in paths.',
      },
    },
  ],
};

export const unit1: Unit = {
  id: 'u1',
  title: 'Getting around',
  lessons: [unit1Lesson1],
};
