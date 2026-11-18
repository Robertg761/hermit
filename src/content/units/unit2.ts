import type { SeedState } from '../../domain/machine';
import type { Goal, Lesson, PerOs, Unit } from '../../domain/lessons/types';
import { build, fill, learn, match, pick, predict, px, same, task, typeAlong } from '../builders';

/** Herme's workshop: a home folder that needs tidying. */
const workshop: SeedState = {
  files: {
    'recipe.txt': 'Kelp chips\n1. Find kelp.\n2. Dry kelp.\n3. Crunch.\n',
    'draft.txt': 'Dear diary, today I found a bigger shell.\n',
    'old-name.txt': 'Rename me.\n',
    'shopping list.txt': 'kelp\nsea salt\n',
    'junk.txt': 'nobody needs this\n',
    'important.txt': 'Do not delete. This is my shell insurance.\n',
    'src/app.js': 'console.log("hi")\n',
    'src/util.js': 'export const add = (a, b) => a + b;\n',
    'junk/old1.tmp': '',
    'junk/old2.tmp': '',
  },
  dirs: ['archive'],
};

const seed = (cwd?: string): PerOs<SeedState> => same(cwd === undefined ? workshop : { ...workshop, cwd });

const dirExists = (path: string): PerOs<Goal> => same({ kind: 'exists', path, type: 'dir' });
const fileExists = (path: string): PerOs<Goal> => same({ kind: 'exists', path, type: 'file' });

// ---------------------------------------------------------------------------
// Lesson 1: Make things (mkdir, touch)
// ---------------------------------------------------------------------------

export const unit2Lesson1: Lesson = {
  id: 'u2-l1',
  title: 'Make things',
  challenges: [
    learn({
      id: 'u2-l1-c1',
      teaches: ['mkdir'],
      seed: seed(),
      card: {
        linux: {
          title: 'mkdir: make a folder',
          body: '`mkdir` (**m**a**k**e **dir**ectory) makes a new folder, like New Folder in your file manager. Directory is another word for folder. When it works it prints nothing: no news is good news.',
          example: 'mkdir notes',
        },
        mac: {
          title: 'mkdir: make a folder',
          body: '`mkdir` (**m**a**k**e **dir**ectory) makes a new folder, like New Folder in Finder. Directory is another word for folder. When it works it prints nothing: no news is good news.',
          example: 'mkdir notes',
        },
        windows: {
          title: 'mkdir: make a folder',
          body: '`mkdir` (**m**a**k**e **dir**ectory) makes a new folder, like New Folder in File Explorer. Directory is another word for folder. In PowerShell `mkdir` is a shortcut for `New-Item -ItemType Directory`, and it shows you the folder it made.',
          example: 'mkdir notes',
        },
      },
    }),
    typeAlong({
      id: 'u2-l1-c2',
      uses: ['mkdir'],
      prompt: same('Make a folder called notes.'),
      seed: seed(),
      goal: dirExists('notes'),
      line: same('mkdir notes'),
      explain: same('A new, empty folder called notes. The folder name is the argument.'),
    }),
    pick({
      id: 'u2-l1-c3',
      uses: ['mkdir', 'cd'],
      prompt: same('Which command makes a new folder called ideas?'),
      options: px(['cd ideas', 'mkdir ideas', 'makedir ideas'], ['New-Folder ideas', 'Set-Location ideas', 'mkdir ideas']),
      answer: px(1, 2),
      reasons: px(
        ['That goes *into* a folder. It has to exist first.', 'Right: make directory.', 'Close, but the real name is shorter: `mkdir`.'],
        ['Sounds right, but there is no such command.', 'That goes *into* a folder. It has to exist first.', 'Right: make directory.'],
      ),
      explain: same('`mkdir ideas` makes it; `cd ideas` would then take you inside.'),
    }),
    task({
      id: 'u2-l1-c4',
      uses: ['ls'],
      review: true,
      prompt: same('This is Herme\'s workshop. Look around: is there a folder called archive?'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'archive' }),
      solutions: px([['ls']], [['Get-ChildItem'], ['ls'], ['dir']]),
      hints: px(['List what is here.', 'Type `ls`.'], ['Get the child items.', 'Type `Get-ChildItem`.']),
      explain: same('Yes: archive is there, along with a lot of clutter. You will tidy it up in this unit.'),
    }),
    learn({
      id: 'u2-l1-c5',
      teaches: ['touch'],
      seed: seed(),
      card: px(
        {
          title: 'touch: make an empty file',
          body: '`touch` makes a new, empty file. (If the file already exists, `touch` only updates its date: it *touches* it.)',
          example: 'touch todo.txt',
        },
        {
          title: 'New-Item: make an empty file',
          body: '`New-Item` makes a new, empty file. PowerShell has no `touch`, so this is the one to remember.',
          example: 'New-Item todo.txt',
        },
      ),
    }),
    build({
      id: 'u2-l1-c6',
      uses: ['touch'],
      prompt: same('Build the command that makes an empty file called todo.txt.'),
      seed: seed(),
      goal: fileExists('todo.txt'),
      tokens: px(['mkdir', 'todo.txt', 'new', 'touch', 'file'], ['-File', 'todo.txt', 'mkdir', 'New-Item', 'touch']),
      solutions: px([['touch todo.txt']], [['New-Item todo.txt']]),
      hints: px(
        ['`mkdir` would make a *folder* called todo.txt.', 'Tap `touch`, then `todo.txt`.'],
        ['`mkdir` would make a *folder* called todo.txt, and PowerShell has no `touch`.', 'Tap `New-Item`, then `todo.txt`.'],
      ),
      explain: same('An empty file, ready for Herme\'s to-do list.'),
    }),
    match({
      id: 'u2-l1-c7',
      uses: ['mkdir', 'touch', 'ls', 'cd'],
      pairs: px(
        [
          ['mkdir', 'Make a folder'],
          ['touch', 'Make an empty file'],
          ['ls', 'List what is here'],
          ['cd', 'Go into a folder'],
        ],
        [
          ['mkdir', 'Make a folder'],
          ['New-Item', 'Make an empty file'],
          ['Get-ChildItem', 'List what is here'],
          ['cd', 'Go into a folder'],
        ],
      ),
      explain: same('Two ways to make things, two ways to get around.'),
    }),
    task({
      id: 'u2-l1-c8',
      uses: ['mkdir', 'cd'],
      openHint: true,
      prompt: same('Make a folder called ideas, then step inside it.'),
      seed: seed(),
      goal: same({ kind: 'cwdIs', path: 'ideas' }),
      solutions: same([['mkdir ideas', 'cd ideas']]),
      hints: same(['Two commands: one to make the folder, one to go in.', 'Type `mkdir ideas`, then `cd ideas`.']),
      explain: same('Make, then move in. Your prompt shows you are inside ideas.'),
    }),
    pick({
      id: 'u2-l1-c9',
      uses: ['cd-up', 'cd-home'],
      review: true,
      prompt: same('You are in ideas. Which command takes you back up to the workshop?'),
      options: same(['cd ~/..', 'cd ..', 'cd up']),
      answer: same(1),
      reasons: same(['That goes to the folder *above* your home.', 'Right: one level up.', 'There is no folder called up.']),
      explain: same('`..` is always the folder above.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Read files (cat, quotes)
// ---------------------------------------------------------------------------

export const unit2Lesson2: Lesson = {
  id: 'u2-l2',
  title: 'Read files',
  challenges: [
    learn({
      id: 'u2-l2-c1',
      teaches: ['cat'],
      seed: seed(),
      card: px(
        { title: 'cat: print a file', body: '`cat` prints what is inside a file. (The name comes from con**cat**enate: give it several files and it joins them.)', example: 'cat recipe.txt' },
        { title: 'Get-Content: print a file', body: '*Get* the *Content* of a file: it prints what is inside. `cat` and `type` work too.', example: 'Get-Content recipe.txt' },
      ),
    }),
    typeAlong({
      id: 'u2-l2-c2',
      uses: ['cat'],
      prompt: same('Print Herme\'s recipe.'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'Kelp chips' }),
      line: px('cat recipe.txt', 'Get-Content recipe.txt'),
      explain: same('Kelp chips, in three easy steps.'),
    }),
    pick({
      id: 'u2-l2-c3',
      uses: ['cat', 'ls'],
      prompt: same('Which command shows what is written *inside* draft.txt?'),
      options: {
        linux: ['ls draft.txt', 'cat draft.txt', 'show draft.txt'],
        mac: ['ls draft.txt', 'cat draft.txt', 'open draft.txt'],
        windows: ['Get-Content draft.txt', 'Get-ChildItem draft.txt', 'Get-File draft.txt'],
      },
      answer: px(1, 0),
      reasons: {
        linux: ['That only shows the file name, not what is inside.', 'Right.', 'There is no `show` command.'],
        mac: ['That only shows the file name, not what is inside.', 'Right.', 'That opens it in another app, not in the terminal.'],
        windows: ['Right.', 'That shows the file and its details, not what is inside.', 'Sounds right, but there is no such command.'],
      },
      explain: px('`ls` shows names; `cat` shows contents.', '`Get-ChildItem` shows names; `Get-Content` shows contents.'),
    }),
    task({
      id: 'u2-l2-c4',
      uses: ['cat'],
      openHint: true,
      prompt: same('What did Herme write in draft.txt?'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'bigger shell' }),
      solutions: px([['cat draft.txt']], [['Get-Content draft.txt'], ['cat draft.txt'], ['type draft.txt']]),
      hints: px(['Print the file.', 'Type `cat draft.txt`.'], ['Get the content of the file.', 'Type `Get-Content draft.txt`.']),
      explain: same('He found a bigger shell. Big day.'),
    }),
    task({
      id: 'u2-l2-c5',
      uses: ['cd', 'ls'],
      review: true,
      prompt: same('Herme keeps code in the src folder. Go in and see which files are there.'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'util.js' }),
      solutions: px([['cd src', 'ls'], ['ls src']], [['cd src', 'Get-ChildItem'], ['Get-ChildItem src'], ['ls src']]),
      hints: px(['Go into src, then list.', 'Type `cd src`, then `ls`.'], ['Go into src, then list.', 'Type `cd src`, then `Get-ChildItem`.']),
      explain: px('Two files. Bonus: `ls src` lists a folder without going into it.', 'Two files. Bonus: `Get-ChildItem src` lists a folder without going into it.'),
    }),
    learn({
      id: 'u2-l2-c6',
      teaches: ['quotes'],
      uses: ['cat'],
      seed: seed(),
      card: px(
        {
          title: 'Names with spaces need quotes',
          body: 'Spaces separate the parts of a command, so `shopping list.txt` looks like two names. Put quotes around it to keep it together.',
          example: 'cat "shopping list.txt"',
        },
        {
          title: 'Names with spaces need quotes',
          body: 'Spaces separate the parts of a command, so `shopping list.txt` looks like two names. Put quotes around it to keep it together.',
          example: 'Get-Content "shopping list.txt"',
        },
      ),
    }),
    fill({
      id: 'u2-l2-c7',
      uses: ['cat', 'quotes'],
      prompt: same('Print the shopping list.'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'sea salt' }),
      template: px('cat ___', 'Get-Content ___'),
      options: same(['shopping list.txt', '"shopping list.txt"', 'shopping', 'list.txt']),
      answer: same(1),
      hints: same(['The name has a space in it.']),
      explain: same('Quotes turned two words into one name.'),
    }),
    task({
      id: 'u2-l2-c8',
      uses: ['touch', 'quotes'],
      prompt: same('Herme wants ONE file called party plan.txt, with a space in the name. This command gets it wrong. Fix it.'),
      seed: seed(),
      prefill: px('touch party plan.txt', 'New-Item party plan.txt'),
      goal: fileExists('party plan.txt'),
      solutions: px(
        [['touch "party plan.txt"'], ["touch 'party plan.txt'"], ['touch party\\ plan.txt']],
        [['New-Item "party plan.txt"'], ["New-Item 'party plan.txt'"]],
      ),
      hints: px(
        ['As written, this makes two files: party and plan.txt.', 'Type `touch "party plan.txt"`.'],
        ['As written, PowerShell sees two names and complains.', 'Type `New-Item "party plan.txt"`.'],
      ),
      explain: same('Single or double quotes both keep a name with spaces together.'),
    }),
    task({
      id: 'u2-l2-c9',
      uses: ['mkdir', 'quotes'],
      prompt: same('Make a folder called old stuff (with a space).'),
      seed: seed(),
      goal: dirExists('old stuff'),
      solutions: same([['mkdir "old stuff"'], ["mkdir 'old stuff'"]]),
      hints: same(['Same trick as the file.', 'Type `mkdir "old stuff"`.']),
      explain: same('Quotes work with every command, not just one.'),
    }),
    pick({
      id: 'u2-l2-c10',
      uses: ['touch', 'mkdir'],
      review: true,
      prompt: same('Which command makes an empty *file*?'),
      options: px(['mkdir notes.txt', 'touch notes.txt', 'cat notes.txt'], ['mkdir notes.txt', 'Get-Content notes.txt', 'New-Item notes.txt']),
      answer: px(1, 2),
      reasons: px(
        ['That makes a *folder* called notes.txt. Confusing, but allowed.', 'Right.', 'That reads a file that already exists.'],
        ['That makes a *folder* called notes.txt. Confusing, but allowed.', 'That reads a file that already exists.', 'Right.'],
      ),
      explain: px('`touch` makes files, `mkdir` makes folders.', '`New-Item` makes files, `mkdir` makes folders.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: Copy and move (cp, mv)
// ---------------------------------------------------------------------------

export const unit2Lesson3: Lesson = {
  id: 'u2-l3',
  title: 'Copy and move',
  challenges: [
    learn({
      id: 'u2-l3-c1',
      teaches: ['cp'],
      seed: seed(),
      card: px(
        { title: 'cp: copy a file', body: '`cp` (**c**o**p**y) takes two names: the file you have, then the new copy. The original stays put.', example: 'cp draft.txt draft-backup.txt' },
        { title: 'Copy-Item: copy a file', body: '`Copy-Item` takes two names: the file you have, then the new copy. The original stays put. `cp` and `copy` work too.', example: 'Copy-Item draft.txt draft-backup.txt' },
      ),
    }),
    typeAlong({
      id: 'u2-l3-c2',
      uses: ['cp'],
      prompt: same('Back up the draft.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'fileContains', path: 'draft-backup.txt', text: 'bigger shell' }, { kind: 'exists', path: 'draft.txt' }] }),
      line: px('cp draft.txt draft-backup.txt', 'Copy-Item draft.txt draft-backup.txt'),
      explain: same('Now there are two: draft.txt and draft-backup.txt, with the same words inside.'),
    }),
    pick({
      id: 'u2-l3-c3',
      uses: ['cp'],
      prompt: px('After `cp notes.txt copy.txt`, which file is new?', 'After `Copy-Item notes.txt copy.txt`, which file is new?'),
      options: same(['notes.txt', 'copy.txt', 'Both are new']),
      answer: same(1),
      reasons: same(['That one was there already: it is the source.', 'Right: the second name is the new copy.', 'The first one already existed.']),
      explain: same('From, then to. Always in that order.'),
    }),
    task({
      id: 'u2-l3-c4',
      uses: ['cat'],
      review: true,
      prompt: same('Before changing anything, read important.txt.'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'shell insurance' }),
      solutions: px([['cat important.txt']], [['Get-Content important.txt'], ['cat important.txt']]),
      hints: px(['Print the file.', 'Type `cat important.txt`.'], ['Get its content.', 'Type `Get-Content important.txt`.']),
      explain: same('Noted. We will not delete that one.'),
    }),
    learn({
      id: 'u2-l3-c5',
      teaches: ['mv'],
      uses: ['cp'],
      seed: seed(),
      card: px(
        {
          title: 'mv: move or rename',
          body: '`mv` (**m**o**v**e) works like `cp`, but the original goes away. Moving a file to a new name in the same folder is how you rename it.',
          example: 'mv old-name.txt new-name.txt',
        },
        {
          title: 'Move-Item: move or rename',
          body: '`Move-Item` works like `Copy-Item`, but the original goes away. Moving a file to a new name in the same folder renames it. (`mv` works too.)',
          example: 'Move-Item old-name.txt new-name.txt',
        },
      ),
    }),
    build({
      id: 'u2-l3-c6',
      uses: ['mv'],
      prompt: same('Rename old-name.txt to new-name.txt.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'exists', path: 'new-name.txt', type: 'file' }, { kind: 'notExists', path: 'old-name.txt' }] }),
      tokens: px(['new-name.txt', 'cp', 'old-name.txt', 'rename', 'mv'], ['new-name.txt', 'Copy-Item', 'old-name.txt', '-Rename', 'Move-Item']),
      solutions: px([['mv old-name.txt new-name.txt']], [['Move-Item old-name.txt new-name.txt']]),
      hints: same(['A copy would leave the old name behind.']),
      explain: same('One file, new name.'),
    }),
    predict({
      id: 'u2-l3-c7',
      uses: ['mv', 'ls'],
      prompt: px(
        'After these lines, what does the last one print?',
        'After these lines, what does the last one print? (`-Name` lists only the names, without the details.)',
      ),
      seed: seed(),
      command: px(['mv draft.txt archive', 'ls archive'], ['Move-Item draft.txt archive', 'Get-ChildItem archive -Name']),
      options: px(['archive', 'draft.txt', 'archive/draft.txt'], ['archive', 'draft.txt', 'archive\\draft.txt']),
      answer: same(1),
      hints: same(['Moving a file *into* an existing folder keeps its name.']),
      explain: same('When the second name is a folder that already exists, the file moves inside it and keeps its name.'),
    }),
    match({
      id: 'u2-l3-c8',
      uses: ['cp', 'mv', 'cat', 'mkdir'],
      pairs: px(
        [
          ['cp', 'Copy a file'],
          ['mv', 'Move or rename'],
          ['cat', 'Print a file'],
          ['mkdir', 'Make a folder'],
        ],
        [
          ['Copy-Item', 'Copy a file'],
          ['Move-Item', 'Move or rename'],
          ['Get-Content', 'Print a file'],
          ['mkdir', 'Make a folder'],
        ],
      ),
      explain: same('Four of the commands people use every day.'),
    }),
    task({
      id: 'u2-l3-c9',
      uses: ['cp'],
      openHint: true,
      prompt: same('Put a copy of recipe.txt inside the archive folder. Keep the original where it is.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'exists', path: 'archive/recipe.txt', type: 'file' }, { kind: 'exists', path: 'recipe.txt' }] }),
      solutions: px([['cp recipe.txt archive'], ['cp recipe.txt archive/recipe.txt']], [['Copy-Item recipe.txt archive'], ['cp recipe.txt archive']]),
      hints: px(['Copy, and give a folder as the second name.', 'Type `cp recipe.txt archive`.'], ['Copy, and give a folder as the second name.', 'Type `Copy-Item recipe.txt archive`.']),
      explain: same('When the second name is a folder, the copy goes inside it with the same name.'),
    }),
    task({
      id: 'u2-l3-c10',
      uses: ['mkdir', 'mv'],
      review: true,
      openHint: true,
      prompt: same('Make a folder called drafts, then move draft.txt into it.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'exists', path: 'drafts/draft.txt', type: 'file' }, { kind: 'notExists', path: 'draft.txt' }] }),
      solutions: px(
        [['mkdir drafts', 'mv draft.txt drafts']],
        [['mkdir drafts', 'Move-Item draft.txt drafts'], ['New-Item -ItemType Directory drafts', 'mv draft.txt drafts']],
      ),
      hints: px(
        ['Two steps: make the folder first, then move the file into it.', 'Type `mkdir drafts`, then `mv draft.txt drafts`.'],
        ['Two steps: make the folder first, then move the file into it.', 'Type `mkdir drafts`, then `Move-Item draft.txt drafts`.'],
      ),
      explain: same('The draft has a folder of its own now. Herme has plans.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 4: Delete (rm, -r)
// ---------------------------------------------------------------------------

export const unit2Lesson4: Lesson = {
  id: 'u2-l4',
  title: 'Delete for good',
  challenges: [
    learn({
      id: 'u2-l4-c1',
      teaches: ['rm'],
      seed: seed(),
      card: px(
        { title: 'rm: delete a file', body: '`rm` (**r**e**m**ove) deletes a file. There is **no Trash** in the terminal: it is gone for good, so read the name twice.', example: 'rm junk.txt' },
        { title: 'Remove-Item: delete a file', body: '`Remove-Item` deletes a file. There is **no Recycle Bin** in the terminal: it is gone for good, so read the name twice. (`rm` and `del` work too.)', example: 'Remove-Item junk.txt' },
      ),
    }),
    typeAlong({
      id: 'u2-l4-c2',
      uses: ['rm'],
      prompt: same('Delete junk.txt. Leave important.txt alone!'),
      seed: seed(),
      protectedPaths: ['important.txt'],
      goal: same({ kind: 'notExists', path: 'junk.txt' }),
      line: px('rm junk.txt', 'Remove-Item junk.txt'),
      explain: px('Gone. No undo, no Trash.', 'Gone. No undo, no Recycle Bin.'),
    }),
    pick({
      id: 'u2-l4-c3',
      uses: ['rm'],
      prompt: same('You deleted a file with the terminal. Where is it now?'),
      options: px(['In the Trash', 'Gone for good', 'Hidden with a dot'], ['In the Recycle Bin', 'Gone for good', 'Hidden']),
      answer: same(1),
      reasons: {
        linux: ['Only your file manager uses the Trash. The terminal does not.', 'Right. That is why careful people read twice.', 'Hiding is different. Deleting removes it.'],
        mac: ['Only Finder uses the Trash. The terminal does not.', 'Right. That is why careful people read twice.', 'Hiding is different. Deleting removes it.'],
        windows: ['Only File Explorer uses the Recycle Bin. The terminal does not.', 'Right. That is why careful people read twice.', 'Hiding is different. Deleting removes it.'],
      },
      explain: same('Terminal deletes are permanent. Hermit is a safe place to practise that.'),
    }),
    task({
      id: 'u2-l4-c4',
      uses: ['cp'],
      review: true,
      prompt: same('Before deleting anything else, back up important.txt as important-backup.txt.'),
      seed: seed(),
      protectedPaths: ['important.txt'],
      goal: same({ kind: 'fileContains', path: 'important-backup.txt', text: 'shell insurance' }),
      solutions: px([['cp important.txt important-backup.txt']], [['Copy-Item important.txt important-backup.txt'], ['cp important.txt important-backup.txt']]),
      hints: px(['Copy: from, then to.', 'Type `cp important.txt important-backup.txt`.'], ['Copy: from, then to.', 'Type `Copy-Item important.txt important-backup.txt`.']),
      explain: same('Backups first. Herme approves.'),
    }),
    learn({
      id: 'u2-l4-c5',
      teaches: ['recursive'],
      uses: ['cp', 'rm'],
      seed: seed(),
      card: px(
        {
          title: '-r: the whole folder',
          body: 'On their own, `cp` and `rm` only handle files. Add `-r` (**r**ecursive) to copy or delete a **folder and everything inside it**. `rm -r` can wipe out a lot at once, so read the name twice.',
          example: 'cp -r src backup',
        },
        {
          title: '-Recurse: the whole folder',
          body: 'Add `-Recurse` to copy or delete a **folder and everything inside it**. Without it, `Copy-Item` copies only the empty folder. `Remove-Item -Recurse` can wipe out a lot at once, so read the name twice.',
          example: 'Copy-Item src backup -Recurse',
        },
      ),
    }),
    build({
      id: 'u2-l4-c6',
      uses: ['cp', 'recursive'],
      prompt: same('Copy the whole src folder, with everything in it, to a new folder called backup.'),
      seed: seed(),
      protectedPaths: ['src'],
      goal: same({ kind: 'all', goals: [{ kind: 'exists', path: 'backup/app.js', type: 'file' }, { kind: 'exists', path: 'backup/util.js', type: 'file' }, { kind: 'exists', path: 'src/app.js' }] }),
      tokens: px(['backup', 'mv', 'cp', 'src', 'rm', '-r'], ['backup', '-Force', 'Copy-Item', 'src', 'Remove-Item', '-Recurse']),
      solutions: px([['cp -r src backup']], [['Copy-Item src backup -Recurse']]),
      hints: px(
        ['Command, flag, from, to.', 'Tap `cp`, `-r`, `src`, `backup`.'],
        ['Command, from, to, then the parameter.', 'Tap `Copy-Item`, `src`, `backup`, `-Recurse`.'],
      ),
      explain: same('The folder and both files inside it were copied.'),
    }),
    task({
      id: 'u2-l4-c7',
      uses: ['rm', 'recursive', 'errors'],
      prompt: same('Herme wants the junk folder and everything in it gone. This command fails. Run it, read the error, then fix it.'),
      seed: seed(),
      protectedPaths: ['important.txt'],
      prefill: px('rm junk', 'rm -rf junk'),
      goal: same({ kind: 'notExists', path: 'junk' }),
      solutions: px([['rm -r junk'], ['rm -rf junk']], [['Remove-Item junk -Recurse -Force'], ['Remove-Item junk -Recurse'], ['rm junk -Recurse']]),
      hints: px(
        ['`rm` refuses to delete folders unless you add the recursive flag.', 'Type `rm -r junk`.'],
        ['`-rf` is how Linux and Mac say it. PowerShell spells it out.', 'Type `Remove-Item junk -Recurse`.'],
      ),
      explain: px(
        '`rm -r` deletes a folder and its contents. You will often see `rm -rf` online: the `f` (force) means it never asks first. Read the name twice before you use it.',
        'You will often see `rm -rf` online, but that is Linux and Mac talk. PowerShell wants `-Recurse`. The `rm` shortcut works here, but it still wants PowerShell parameters.',
      ),
    }),
    match({
      id: 'u2-l4-c8',
      uses: ['rm', 'recursive', 'cp', 'mv'],
      pairs: px(
        [
          ['rm', 'Delete a file'],
          ['rm -r', 'Delete a folder'],
          ['cp -r', 'Copy a folder'],
          ['mv', 'Move or rename'],
        ],
        [
          ['Remove-Item', 'Delete a file'],
          ['Remove-Item -Recurse', 'Delete a folder'],
          ['Copy-Item -Recurse', 'Copy a folder'],
          ['Move-Item', 'Move or rename'],
        ],
      ),
      explain: px('Folders need `-r`. Files do not.', 'Folders need `-Recurse`. Files do not.'),
    }),
    task({
      id: 'u2-l4-c9',
      uses: ['rm', 'recursive'],
      openHint: true,
      prompt: same('Clean-up time: delete junk.txt and the junk folder. Keep important.txt!'),
      seed: seed(),
      protectedPaths: ['important.txt'],
      goal: same({ kind: 'all', goals: [{ kind: 'notExists', path: 'junk' }, { kind: 'notExists', path: 'junk.txt' }] }),
      solutions: px([['rm junk.txt', 'rm -r junk'], ['rm -r junk junk.txt']], [['Remove-Item junk.txt', 'Remove-Item junk -Recurse'], ['rm junk.txt', 'rm junk -Recurse']]),
      hints: px(['Two things to delete: a file and a folder.', 'Type `rm junk.txt`, then `rm -r junk`.'], ['Two things to delete: a file and a folder.', 'Type `Remove-Item junk.txt`, then `Remove-Item junk -Recurse`.']),
      explain: same('The workshop is tidy. Herme is weeping (happily).'),
    }),
    predict({
      id: 'u2-l4-c10',
      uses: ['mkdir', 'ls'],
      review: true,
      prompt: px(
        'Herme runs these two lines. What does the second one print?',
        'Herme runs these two lines. What does the second one print? (`-Name` lists only the names.)',
      ),
      seed: seed(),
      command: px(['mkdir archive/2026', 'ls archive'], ['mkdir archive\\2026', 'Get-ChildItem archive -Name']),
      options: px(['archive', '2026', 'archive/2026'], ['archive', '2026', 'archive\\2026']),
      answer: same(1),
      hints: same(['Listing a folder shows what is *inside* it.']),
      explain: same('Listing a folder shows its contents, so you see the new folder 2026 by itself.'),
    }),
  ],
};

export const unit2: Unit = {
  id: 'u2',
  title: 'Files and folders',
  blurb: 'Make, read, copy, move and delete files.',
  lessons: [unit2Lesson1, unit2Lesson2, unit2Lesson3, unit2Lesson4],
};
