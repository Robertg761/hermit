import type { SeedState } from '../../domain/machine';
import { same, type Lesson, type PerOs, type Unit } from '../../domain/lessons/types';
import { predict } from '../builders';

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
  title: 'Look around',
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
    predict({
      id: 'u1-l1-c5',
      prompt: same('Shellby opened a fresh terminal and typed this. What does it print?'),
      seed: seedAt(),
      command: { linux: ['pwd'], mac: ['pwd'], windows: ['Get-Location'] },
      options: {
        linux: ['/home/you', '/', '/Users/you'],
        mac: ['/', '/Users/you', '/home/you'],
        windows: ['C:\\', 'C:\\Windows', 'C:\\Users\\you'],
      },
      answer: { linux: 0, mac: 1, windows: 2 },
      hints: same(['A new terminal always starts in your home folder.']),
      explain: {
        linux: 'New terminals open in your home folder, which is /home/you on Linux.',
        mac: 'New terminals open in your home folder, which is /Users/you on macOS.',
        windows: 'New PowerShell windows open in your profile folder, C:\\Users\\you.',
      },
    }),
  ],
};

export const unit1Lesson2: Lesson = {
  id: 'u1-l2',
  title: 'Move around',
  challenges: [
    {
      id: 'u1-l2-c1',
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
      id: 'u1-l2-c2',
      type: 'do',
      prompt: same('You are in projects/website. Go up exactly one folder, to projects.'),
      seed: seedAt('projects/website'),
      goal: same({ kind: 'cwdIs', path: 'projects' }),
      solutions: { linux: [['cd ..']], mac: [['cd ..']], windows: [['cd ..'], ['Set-Location ..']] },
      hints: {
        linux: ['Two dots mean "the folder above this one".', 'Type `cd ..`.'],
        mac: ['Two dots mean "the folder above this one".', 'Type `cd ..`.'],
        windows: ['Two dots mean "the folder above this one", on Windows too.', 'Type `cd ..`.'],
      },
      explain: same('`..` always means the parent folder, so `cd ..` climbs one level.'),
    },
    {
      id: 'u1-l2-c3',
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
    predict({
      id: 'u1-l2-c4',
      prompt: same('Starting at home, Shellby types these lines. What does the last one print?'),
      seed: seedAt(),
      command: {
        linux: ['cd projects/game', 'cd ..', 'pwd'],
        mac: ['cd projects/game', 'cd ..', 'pwd'],
        windows: ['cd projects\\game', 'cd ..', 'Get-Location'],
      },
      options: {
        linux: ['/home/you/projects/game', '/home/you/projects', '/home/you'],
        mac: ['/Users/you/projects', '/Users/you', '/Users/you/projects/game'],
        windows: ['C:\\Users\\you', 'C:\\Users\\you\\projects\\game', 'C:\\Users\\you\\projects'],
      },
      answer: { linux: 1, mac: 0, windows: 2 },
      hints: same(['`..` undoes one step of the path.']),
      explain: same('You went down two levels, then up one, so you end up in projects.'),
    }),
    {
      id: 'u1-l2-c5',
      type: 'fix',
      prompt: same('Shellby tried to jump into the game folder but fumbled the spelling. Fix the command and run it.'),
      seed: seedAt(),
      prefill: { linux: 'cd projects/gaem', mac: 'cd projects/gaem', windows: 'cd projects\\gaem' },
      goal: same({ kind: 'cwdIs', path: 'projects/game' }),
      solutions: {
        linux: [['cd projects/game']],
        mac: [['cd projects/game']],
        windows: [['cd projects\\game'], ['Set-Location projects/game']],
      },
      hints: {
        linux: ['Read the error: the folder name is misspelled.', 'Type `cd projects/game`.'],
        mac: ['Read the error: the folder name is misspelled.', 'Type `cd projects/game`.'],
        windows: ['Read the error: the folder name is misspelled.', 'Type `cd projects\\game`.'],
      },
      explain: {
        linux: 'You can `cd` through several folders at once with a path like `projects/game`.',
        mac: 'You can `cd` through several folders at once with a path like `projects/game`.',
        windows: 'You can `cd` through several folders at once. PowerShell accepts `projects\\game` or `projects/game`.',
      },
    },
  ],
};

export const unit1: Unit = {
  id: 'u1',
  title: 'Getting around',
  blurb: 'Find out where you are and move between folders.',
  lessons: [unit1Lesson1, unit1Lesson2],
};
