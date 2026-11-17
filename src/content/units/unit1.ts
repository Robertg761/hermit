import type { SeedState } from '../../domain/machine';
import type { Goal, Lesson, PerOs, Unit } from '../../domain/lessons/types';
import { build, byHome, fill, learn, match, pick, predict, px, same, task, typeAlong } from '../builders';

/** The learner's home folder in Unit 1: a small, lived-in burrow. */
const burrow = (os: 'posix' | 'windows'): SeedState => ({
  files: {
    'notes.txt': 'Buy more shells.\nFind a bigger shell.\n',
    'projects/website/index.html': '<h1>My shell</h1>\n',
    'projects/website/style.css': 'h1 { color: coral; }\n',
    'projects/game/main.py': 'print("crab rave")\n',
    'photos/beach.jpg': 'JPEG',
    'photos/tidepool.jpg': 'JPEG',
    ...(os === 'posix'
      ? { '.herme-secret': 'I was a snail once.\n', 'projects/.plan': 'Step 1: bigger shell.\n' }
      : { 'herme-secret.txt': 'I was a snail once.\n', 'projects/plan.txt': 'Step 1: bigger shell.\n' }),
  },
  ...(os === 'windows' ? { hidden: ['herme-secret.txt', 'projects/plan.txt'] } : {}),
});

const seedAt = (cwd?: string): PerOs<SeedState> => {
  const at = (s: SeedState): SeedState => (cwd === undefined ? s : { ...s, cwd });
  return { linux: at(burrow('posix')), mac: at(burrow('posix')), windows: at(burrow('windows')) };
};

/**
 * The output shows the path of `rel`. On Windows, `Get-ChildItem` also prints the path (in its
 * "Directory:" header), so a listing is ruled out: it answers "what's here", not "where am I".
 */
const printsPath = (rel = ''): PerOs<Goal> => {
  const p = byHome((h) => (rel === '' ? h : `${h}/${rel}`), rel === '' ? 'C:\\Users\\you' : `C:\\Users\\you\\${rel.replace(/\//g, '\\')}`);
  return {
    linux: { kind: 'stdoutIncludes', text: p.linux },
    mac: { kind: 'stdoutIncludes', text: p.mac },
    windows: { kind: 'all', goals: [{ kind: 'stdoutIncludes', text: p.windows }, { kind: 'stdoutExcludes', text: 'LastWriteTime' }] },
  };
};

// ---------------------------------------------------------------------------
// Lesson 1: Hello, terminal
// ---------------------------------------------------------------------------

export const unit1Lesson1: Lesson = {
  id: 'u1-l1',
  title: 'Hello, terminal',
  challenges: [
    learn({
      id: 'u1-l1-c1',
      teaches: ['prompt'],
      seed: seedAt(),
      card: {
        linux: {
          title: 'This is a terminal',
          body: 'You talk to your computer by typing. The line ending in `$` is the **prompt**: it means "your turn". It shows who you are (`you`), which computer (`hermit`) and where you are (`~` is your home folder, the one your file manager opens to).',
        },
        mac: {
          title: 'This is a terminal',
          body: 'You talk to your computer by typing. The line ending in `%` is the **prompt**: it means "your turn". It shows who you are (`you`), which computer (`Hermits-MacBook`) and where you are (`~` is your home folder, the one Finder opens to).',
        },
        windows: {
          title: 'This is a terminal',
          body: 'You talk to your computer by typing. The line ending in `>` is the **prompt**: it means "your turn". `PS` means PowerShell, then comes where you are: `C:\\Users\\you`, your home folder, the one File Explorer opens to.',
        },
      },
    }),
    learn({
      id: 'u1-l1-c2',
      teaches: ['pwd'],
      uses: ['prompt'],
      seed: seedAt(),
      card: {
        linux: { title: 'pwd: where am I?', body: "You're always standing in exactly one folder. `pwd` (**p**rint **w**orking **d**irectory) tells you which. *Directory* is another word for folder.", example: 'pwd' },
        mac: { title: 'pwd: where am I?', body: "You're always standing in exactly one folder. `pwd` (**p**rint **w**orking **d**irectory) tells you which. *Directory* is another word for folder.", example: 'pwd' },
        windows: {
          title: 'Get-Location: where am I?',
          body: "You're always standing in exactly one folder. `Get-Location` tells you which. PowerShell commands are a verb and a noun: *Get* the *Location*. The short `pwd` works too.",
          example: 'Get-Location',
        },
      },
    }),
    typeAlong({
      id: 'u1-l1-c3',
      uses: ['pwd'],
      prompt: same('Your turn. Type it and press Enter.'),
      seed: seedAt(),
      goal: printsPath(),
      line: px('pwd', 'Get-Location'),
      also: px([], [['pwd']]),
      explain: {
        linux: "That's a **path**, the address of a folder. Read it left to right: from the top (`/`), into `home`, into `you`.",
        mac: "That's a **path**, the address of a folder. Read it left to right: from the top (`/`), into `Users`, into `you`.",
        windows: "That's a **path**, the address of a folder. Read it left to right: the `C:` drive, into `Users`, into `you`.",
      },
    }),
    pick({
      id: 'u1-l1-c4',
      uses: ['pwd'],
      prompt: px('What does `pwd` do?', 'What does `Get-Location` do?'),
      options: px(
        ["Shows which folder you're in", 'Shows your password', 'Lists the files here'],
        ["Shows which folder you're in", 'Finds your location on a map', 'Lists the files here'],
      ),
      answer: same(0),
      reasons: px(
        ['Right: print working directory.', 'Easy mix-up, but pwd is not your password. Never type passwords into random commands.', "That's a different command. You'll meet it next lesson."],
        ['Right: your location among the folders.', 'Location here means your place among the folders, not on Earth.', "That's a different command. You'll meet it next lesson."],
      ),
      explain: px('`pwd` prints the folder you are standing in.', '`Get-Location` shows the folder you are standing in.'),
    }),
    predict({
      id: 'u1-l1-c5',
      uses: ['pwd'],
      prompt: same('Herme is in the photos folder, inside your home folder. He types this. What prints?'),
      seed: seedAt('photos'),
      command: px(['pwd'], ['Get-Location']),
      options: {
        linux: ['/home/you/photos', '/photos', '/home/you'],
        mac: ['/Users/you', '/Users/you/photos', '/photos'],
        windows: ['C:\\photos', 'C:\\Users\\you', 'C:\\Users\\you\\photos'],
      },
      answer: { linux: 0, mac: 1, windows: 2 },
      hints: same(['The path is the whole address, from the top down to the folder you are in.']),
      explain: same('A path always starts at the very top, so photos sits at the end of your home folder path.'),
    }),
    learn({
      id: 'u1-l1-c6',
      teaches: ['errors'],
      uses: ['prompt'],
      seed: seedAt(),
      card: px(
        { title: 'Mistakes are safe', body: "If the terminal doesn't know a word, it says so and gives you the prompt back. Nothing breaks. Read the message: it usually tells you what went wrong.", example: 'herme' },
        { title: 'Mistakes are safe', body: "If PowerShell doesn't know a word, it says so and gives you the prompt back. Nothing breaks. Read the message: it usually tells you what went wrong.", example: 'herme' },
      ),
    }),
    task({
      id: 'u1-l1-c7',
      uses: ['pwd', 'errors'],
      prompt: same('Herme typed this and got an error. Press Enter to see it, then type the command correctly.'),
      seed: seedAt(),
      prefill: px('pdw', 'Get-Locaton'),
      goal: printsPath(),
      solutions: px([['pwd']], [['Get-Location'], ['pwd']]),
      hints: px(['The letters are in the wrong order.', 'Type `pwd`.'], ['One letter is missing.', 'Type `Get-Location`.']),
      explain: px('"command not found" means there is no command with that name. Usually it is a typo.', '"is not recognized" means PowerShell has no command with that name. Usually it is a typo.'),
    }),
    task({
      id: 'u1-l1-c8',
      uses: ['pwd'],
      openHint: true,
      prompt: same("Herme moved you while you weren't looking. Find out where you are."),
      seed: seedAt('projects/game'),
      goal: printsPath('projects/game'),
      solutions: px([['pwd']], [['Get-Location'], ['pwd']]),
      hints: px(['Ask the terminal for your working directory.', 'Type `pwd`.'], ['*Get* your *Location*.', 'Type `Get-Location`.']),
      explain: same('You are in the game folder, inside projects, inside your home folder. The prompt hints at it too.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Look around
// ---------------------------------------------------------------------------

export const unit1Lesson2: Lesson = {
  id: 'u1-l2',
  title: 'Look around',
  challenges: [
    learn({
      id: 'u1-l2-c1',
      teaches: ['ls'],
      seed: seedAt(),
      card: {
        linux: { title: "ls: what's here?", body: "`ls` (short for **l**i**s**t) shows what's inside the folder you're in, like opening it in your file manager.", example: 'ls' },
        mac: { title: "ls: what's here?", body: "`ls` (short for **l**i**s**t) shows what's inside the folder you're in, like opening it in Finder.", example: 'ls' },
        windows: {
          title: "Get-ChildItem: what's here?",
          body: "`Get-ChildItem` shows what's inside the folder you're in, like opening it in File Explorer. *Get* the *child items*: the things inside. `ls` and `dir` work too.",
          example: 'Get-ChildItem',
        },
      },
    }),
    typeAlong({
      id: 'u1-l2-c2',
      uses: ['ls'],
      prompt: same('Type it and press Enter.'),
      seed: seedAt(),
      goal: same({ kind: 'stdoutIncludes', text: 'projects' }),
      line: px('ls', 'Get-ChildItem'),
      explain: {
        linux: 'Folders and files both show up. Names ending in `.txt` or `.jpg` are files; the blue ones are folders.',
        mac: 'Folders and files both show up. Names ending in `.txt` or `.jpg` are files; the rest are folders.',
        windows: 'Folders and files both show up. Folders have a `d` in the Mode column and no Length (size).',
      },
    }),
    pick({
      id: 'u1-l2-c3',
      uses: ['ls', 'pwd'],
      prompt: same('You want to see what is in this folder. Which command?'),
      options: px(['pwd', 'ls', 'list'], ['Get-Location', 'Get-Files', 'Get-ChildItem']),
      answer: px(1, 2),
      reasons: px(
        ['That tells you *where* you are, not what is there.', 'Right: list.', "Close in meaning, but commands are short. There's no `list` command."],
        ['That tells you *where* you are, not what is there.', "Sounds right, but there's no such command. The things in a folder are its *child items*.", 'Right: the child items are what is inside.'],
      ),
      explain: px('`ls` lists what is here.', '`Get-ChildItem` lists what is here.'),
    }),
    task({
      id: 'u1-l2-c4',
      uses: ['ls'],
      openHint: true,
      prompt: same('You are in the photos folder. Which photos does Herme have?'),
      seed: seedAt('photos'),
      goal: same({ kind: 'stdoutIncludes', text: 'tidepool.jpg' }),
      solutions: px([['ls']], [['Get-ChildItem'], ['ls'], ['dir']]),
      hints: px(['List what is here.', 'Type `ls`.'], ['Get the child items.', 'Type `Get-ChildItem`.']),
      explain: same('Two photos: beach.jpg and tidepool.jpg.'),
    }),
    pick({
      id: 'u1-l2-c5',
      uses: ['pwd', 'ls'],
      review: true,
      prompt: same('Which command tells you where you are?'),
      options: px(['pwd', 'ls', 'where'], ['Get-ChildItem', 'Get-Location', 'Get-Where']),
      answer: px(0, 1),
      reasons: px(
        ['Right: print working directory.', 'That lists what is here.', "Sounds right, but `where` won't tell you where *you* are."],
        ['That lists what is here.', 'Right: *Get* your *Location*.', "There's no such command. Where you are is your *Location*."],
      ),
      explain: px('`pwd` prints your working directory.', '`Get-Location` shows the folder you are in.'),
    }),
    learn({
      id: 'u1-l2-c6',
      teaches: ['ls-a'],
      uses: ['ls'],
      seed: seedAt(),
      card: px(
        {
          title: 'Flags change how a command works',
          body: 'A **flag** starts with a dash and comes after the command, with a space between. `ls -a` means "list **a**ll of them". Names starting with a dot are hidden, and `-a` shows them. (Skip the lone `.` and `..` for now. You will meet them soon.)',
          example: 'ls -a',
        },
        {
          title: 'Parameters change how a command works',
          body: 'A **parameter** starts with a dash and comes after the command, with a space between. `Get-ChildItem -Force` *forces* hidden files to show. A hidden file gets an `h` in its Mode.',
          example: 'Get-ChildItem -Force',
        },
      ),
    }),
    build({
      id: 'u1-l2-c7',
      uses: ['ls-a'],
      prompt: same('Build the command that reveals hidden files.'),
      seed: seedAt(),
      goal: px({ kind: 'stdoutIncludes', text: '.herme-secret' }, { kind: 'stdoutIncludes', text: 'herme-secret.txt' }),
      tokens: px(['all', 'ls', 'pwd', '-a', 'a'], ['-Show', 'Get-ChildItem', 'Force', 'Get-Location', '-Force']),
      solutions: px([['ls -a']], [['Get-ChildItem -Force']]),
      hints: px(['Command first, then the flag with its dash.'], ['Command first, then the parameter with its dash.']),
      explain: px('There it is: `.herme-secret`. The dot at the start is what hides it.', 'There it is: `herme-secret.txt`, with an `h` for hidden in its Mode.'),
    }),
    match({
      id: 'u1-l2-c8',
      uses: ['pwd', 'ls', 'ls-a'],
      pairs: px(
        [
          ['pwd', 'Where am I?'],
          ['ls', "What's in here?"],
          ['ls -a', "What's in here, hidden things too?"],
        ],
        [
          ['Get-Location', 'Where am I?'],
          ['Get-ChildItem', "What's in here?"],
          ['Get-ChildItem -Force', "What's in here, hidden things too?"],
        ],
      ),
      explain: same('Three questions you will ask the terminal all the time.'),
    }),
    task({
      id: 'u1-l2-c9',
      uses: ['ls-a'],
      openHint: true,
      prompt: same('Something is hiding in projects too. You are already in projects. Find it.'),
      seed: seedAt('projects'),
      goal: px({ kind: 'stdoutIncludes', text: '.plan' }, { kind: 'stdoutIncludes', text: 'plan.txt' }),
      solutions: px([['ls -a'], ['ls -A']], [['Get-ChildItem -Force'], ['ls -Force'], ['dir -Force']]),
      hints: px(['A plain list hides it. Add the flag for *all*.', 'Type `ls -a`.'], ['A plain list hides it. Force it to show.', 'Type `Get-ChildItem -Force`.']),
      explain: px('Herme has a `.plan`. Hidden files often hold settings and notes.', 'Herme has a hidden `plan.txt`. Hidden files often hold settings and notes.'),
    }),
    task({
      id: 'u1-l2-c10',
      uses: ['pwd'],
      review: true,
      prompt: same('Before you go: Herme has moved you again. Check exactly where you are.'),
      seed: seedAt('photos'),
      goal: printsPath('photos'),
      solutions: px([['pwd']], [['Get-Location'], ['pwd']]),
      hints: px(['Print your working directory.', 'Type `pwd`.'], ['Get your location.', 'Type `Get-Location`.']),
      explain: same('You were in photos all along.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: Step inside
// ---------------------------------------------------------------------------

export const unit1Lesson3: Lesson = {
  id: 'u1-l3',
  title: 'Step inside',
  challenges: [
    learn({
      id: 'u1-l3-c1',
      teaches: ['cd'],
      seed: seedAt(),
      card: px(
        {
          title: 'cd: go into a folder',
          body: '`cd` (**c**hange **d**irectory) is like double-clicking a folder. It prints nothing, but your prompt changes to show where you are. To go more than one folder deep, join the names with `/`: `cd projects/game`.',
          example: 'cd projects',
        },
        {
          title: 'Set-Location: go into a folder',
          body: '`Set-Location` is like double-clicking a folder: *Set* your *Location*. Its short name `cd` is what everyone types. It prints nothing, but your prompt changes to show where you are. To go more than one folder deep, join the names with `\\`: `cd projects\\game`.',
          example: 'cd projects',
        },
      ),
    }),
    typeAlong({
      id: 'u1-l3-c2',
      uses: ['cd'],
      prompt: same('Type it and watch the prompt change.'),
      seed: seedAt(),
      goal: same({ kind: 'cwdIs', path: 'projects' }),
      line: same('cd projects'),
      explain: {
        linux: 'Your prompt now ends in `~/projects`: you are inside projects.',
        mac: 'Your prompt now shows `projects`: you are inside it.',
        windows: 'Your prompt now ends in `\\projects>`: you are inside projects.',
      },
    }),
    task({
      id: 'u1-l3-c3',
      uses: ['ls'],
      review: true,
      prompt: same('You are in projects now. What is inside?'),
      seed: seedAt('projects'),
      goal: same({ kind: 'stdoutIncludes', text: 'website' }),
      solutions: px([['ls']], [['Get-ChildItem'], ['ls'], ['dir']]),
      hints: px(['List what is here.', 'Type `ls`.'], ['Get the child items.', 'Type `Get-ChildItem`.']),
      explain: same('Two folders: game and website.'),
    }),
    build({
      id: 'u1-l3-c4',
      uses: ['cd'],
      prompt: same('You are in projects. Build the command that walks into the game folder.'),
      seed: seedAt('projects'),
      goal: same({ kind: 'cwdIs', path: 'projects/game' }),
      tokens: px(['into', 'cd', 'pwd', 'game', 'ls'], ['-Into', 'Get-Location', 'game', 'Set-Location', 'Get-ChildItem']),
      solutions: px([['cd game']], [['Set-Location game']]),
      hints: same(['Command first, then the folder you want to go into.']),
      explain: same('The folder name is the **argument**: the thing the command acts on.'),
    }),
    learn({
      id: 'u1-l3-c5',
      teaches: ['cd-up'],
      uses: ['cd'],
      seed: seedAt('projects/game'),
      card: px(
        { title: '.. is the folder above', body: 'Two dots always mean "one level up". You are in game, so `cd ..` climbs back out to projects. (That is the `..` you saw in `ls -a`.)', example: 'cd ..' },
        { title: '.. is the folder above', body: 'Two dots always mean "one level up". You are in game, so `cd ..` climbs back out to projects.', example: 'cd ..' },
      ),
    }),
    fill({
      id: 'u1-l3-c6',
      uses: ['cd-up'],
      prompt: same('You are in game. Go up one folder.'),
      seed: seedAt('projects/game'),
      goal: same({ kind: 'cwdIs', path: 'projects' }),
      template: same('cd ___'),
      options: same(['up', '..', '.', 'back']),
      answer: same(1),
      hints: same(['Two dots mean the folder above.']),
      explain: same('`..` is the folder above. One dot, `.`, means the folder you are already in.'),
    }),
    predict({
      id: 'u1-l3-c7',
      uses: ['cd', 'cd-up', 'pwd'],
      prompt: same('Starting at home, Herme types these lines. What does the last one print?'),
      seed: seedAt(),
      command: px(['cd projects/game', 'cd ..', 'pwd'], ['cd projects\\game', 'cd ..', 'Get-Location']),
      options: {
        linux: ['/home/you/projects/game', '/home/you/projects', '/home/you'],
        mac: ['/Users/you/projects', '/Users/you', '/Users/you/projects/game'],
        windows: ['C:\\Users\\you', 'C:\\Users\\you\\projects\\game', 'C:\\Users\\you\\projects'],
      },
      answer: { linux: 1, mac: 0, windows: 2 },
      hints: same(['`..` undoes one step of the path.']),
      explain: same('You went down two levels, then up one, so you end up in projects.'),
    }),
    task({
      id: 'u1-l3-c8',
      uses: ['cd', 'errors'],
      prompt: same('Herme tried to jump into the game folder but fumbled the spelling. Press Enter to read the error, then type it correctly.'),
      seed: seedAt(),
      prefill: px('cd projects/gaem', 'cd projects\\gaem'),
      goal: same({ kind: 'cwdIs', path: 'projects/game' }),
      solutions: px([['cd projects/game']], [['cd projects\\game'], ['Set-Location projects/game']]),
      hints: px(['Read the error: the folder name is misspelled.', 'Type `cd projects/game`.'], ['Read the error: the folder name is misspelled.', 'Type `cd projects\\game`.']),
      explain: px(
        'The error named the exact part it could not find: `gaem`. Errors are clues.',
        'The error named the exact path it could not find. Errors are clues. (PowerShell also accepts `/`, as in `projects/game`.)',
      ),
    }),
    task({
      id: 'u1-l3-c9',
      uses: ['cd', 'cd-up'],
      openHint: true,
      prompt: same('You are in website. Get to the game folder next door.'),
      seed: seedAt('projects/website'),
      goal: same({ kind: 'cwdIs', path: 'projects/game' }),
      solutions: px([['cd ..', 'cd game'], ['cd ../game']], [['cd ..', 'cd game'], ['cd ..\\game'], ['cd ../game']]),
      hints: same(['First climb up to projects, then step into game.', 'Type `cd ..`, then `cd game`.']),
      explain: px('Two steps, or one: `cd ../game` goes up and into game in a single path.', 'Two steps, or one: `cd ..\\game` goes up and into game in a single path.'),
    }),
    pick({
      id: 'u1-l3-c10',
      uses: ['ls-a'],
      review: true,
      prompt: same('Which command shows hidden files too?'),
      options: px(['ls -a', 'ls a', 'ls-a'], ['Get-ChildItem Force', 'Get-ChildItem -Force', 'Get-ChildItem-Force']),
      answer: px(0, 1),
      reasons: px(
        ['Right: command, space, dash, flag.', 'Without the dash, `a` is treated as a folder name.', 'Without a space, the terminal looks for a command called `ls-a`.'],
        ['Without the dash, `Force` is treated as a folder name.', 'Right: command, space, dash, parameter.', 'Without a space, PowerShell looks for a command with that whole name.'],
      ),
      explain: px('A flag needs a space before it and a dash at its start.', 'A parameter needs a space before it and a dash at its start.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 4: Shortcuts and details
// ---------------------------------------------------------------------------

export const unit1Lesson4: Lesson = {
  id: 'u1-l4',
  title: 'Shortcuts and details',
  challenges: [
    learn({
      id: 'u1-l4-c1',
      teaches: ['cd-home'],
      uses: ['cd'],
      seed: seedAt('projects/website'),
      card: px(
        {
          title: '~ means home',
          body: '`~` (a tilde) is short for your home folder. It is the `~` you have seen in your prompt. `cd ~` takes you home from anywhere. (Plain `cd` does too.) On a US keyboard, type it with Shift and the key below Esc.',
          example: 'cd ~',
        },
        {
          title: '~ means home',
          body: '`~` (a tilde) is short for your home folder, `C:\\Users\\you`. `cd ~` takes you home from anywhere. On a US keyboard, type it with Shift and the key below Esc.',
          example: 'cd ~',
        },
      ),
    }),
    task({
      id: 'u1-l4-c2',
      uses: ['cd-home'],
      openHint: true,
      prompt: px('You wandered deep into projects/website. Head back to your home folder.', 'You wandered deep into projects\\website. Head back to your home folder.'),
      seed: seedAt('projects/website'),
      goal: same({ kind: 'cwdIs', path: '' }),
      solutions: px([['cd ~'], ['cd'], ['cd ../..']], [['cd ~'], ['Set-Location ~'], ['cd ..\\..']]),
      hints: px(['`~` means home.', 'Type `cd ~`.'], ['`~` means home in PowerShell too.', 'Type `cd ~`.']),
      explain: same('`cd ~` jumps straight home, no matter how deep you are.'),
    }),
    pick({
      id: 'u1-l4-c3',
      uses: ['cd-home', 'cd-up'],
      prompt: same('Which command takes you home from *anywhere*?'),
      options: same(['cd home', 'cd ..', 'cd ~', 'home']),
      answer: same(2),
      reasons: same([
        'That looks for a folder called home inside the one you are in.',
        'That only climbs one level.',
        'Right: `~` is always your home folder.',
        'There is no `home` command.',
      ]),
      explain: same('`~` is a shortcut for your home folder, wherever you are.'),
    }),
    learn({
      id: 'u1-l4-c4',
      teaches: ['ls-l'],
      uses: ['ls'],
      seed: seedAt('photos'),
      card: px(
        {
          title: 'ls -l: the long list',
          body: '`-l` (**l**ong) adds details. Each line shows permissions (who may read or change it), the owner (`you`), the size in bytes, when it last changed, and the name. Skip the other bits for now.',
          example: 'ls -l',
        },
        {
          title: 'The details are already there',
          body: 'No parameter needed: `Get-ChildItem` already shows details. `Mode` is the type and settings, `LastWriteTime` is when it last changed, `Length` is the size in bytes.',
          example: 'Get-ChildItem',
        },
      ),
    }),
    typeAlong({
      id: 'u1-l4-c5',
      uses: ['ls-l'],
      prompt: same('You are in photos. List what is here, with details.'),
      seed: seedAt('photos'),
      goal: px({ kind: 'stdoutIncludes', text: 'rw-r--r--' }, { kind: 'stdoutIncludes', text: 'LastWriteTime' }),
      line: px('ls -l', 'Get-ChildItem'),
      explain: same('Each photo is 4 bytes here. Real photos are millions of bytes.'),
    }),
    pick({
      id: 'u1-l4-c6',
      uses: ['ls-l'],
      prompt: px('Which flag adds sizes and dates to `ls`?', 'Which column shows when a file last changed?'),
      options: px(['-a', '-l', '-size'], ['Mode', 'Length', 'LastWriteTime']),
      answer: px(1, 2),
      reasons: px(
        ['That shows hidden files.', 'Right: long.', 'Not a real flag.'],
        ['That shows the type and settings.', 'That is the size in bytes.', 'Right: the last time it was written to.'],
      ),
      explain: px('`ls -l` is the long listing.', '`LastWriteTime` is when the file last changed.'),
    }),
    match({
      id: 'u1-l4-c7',
      uses: ['pwd', 'ls', 'ls-a', 'cd-up', 'cd-home'],
      review: true,
      pairs: px(
        [
          ['pwd', 'Where am I?'],
          ['ls', "What's in here?"],
          ['ls -a', 'Show hidden files too'],
          ['cd ..', 'Go up one folder'],
          ['cd ~', 'Go home'],
        ],
        [
          ['Get-Location', 'Where am I?'],
          ['Get-ChildItem', "What's in here?"],
          ['Get-ChildItem -Force', 'Show hidden files too'],
          ['cd ..', 'Go up one folder'],
          ['cd ~', 'Go home'],
        ],
      ),
      explain: same('Five commands, and you can already find your way around a computer.'),
    }),
    task({
      id: 'u1-l4-c8',
      uses: ['ls', 'cd'],
      prompt: same('Herme lost his tidepool photo. Go to the folder it is in.'),
      seed: seedAt(),
      goal: same({ kind: 'cwdIs', path: 'photos' }),
      solutions: px([['ls', 'cd photos'], ['cd photos']], [['Get-ChildItem', 'cd photos'], ['cd photos']]),
      hints: px(
        ['Look around with `ls` first. Which folder sounds like it holds photos?', 'Type `cd photos`.'],
        ['Look around with `Get-ChildItem` first. Which folder sounds like it holds photos?', 'Type `cd photos`.'],
      ),
      explain: same('Look first, then move: that is most of using a terminal.'),
    }),
    task({
      id: 'u1-l4-c9',
      uses: ['ls-a'],
      review: true,
      prompt: same('Something is hidden in your home folder. Find it.'),
      seed: seedAt(),
      goal: px({ kind: 'stdoutIncludes', text: '.herme-secret' }, { kind: 'stdoutIncludes', text: 'herme-secret.txt' }),
      solutions: px([['ls -a'], ['ls -la'], ['ls -A']], [['Get-ChildItem -Force'], ['ls -Force'], ['dir -Force']]),
      hints: px(['Hidden files need a flag.', 'Type `ls -a`.'], ['Hidden files need a parameter.', 'Type `Get-ChildItem -Force`.']),
      explain: same('Herme was a snail once. Now you know.'),
    }),
  ],
};

export const unit1: Unit = {
  id: 'u1',
  title: 'Getting around',
  blurb: 'Meet the terminal, find out where you are, and move between folders.',
  lessons: [unit1Lesson1, unit1Lesson2, unit1Lesson3, unit1Lesson4],
};
