import type { SeedState } from '../../domain/machine';
import type { Goal, Lesson, PerOs, Unit } from '../../domain/lessons/types';
import { build, fill, learn, match, pick, predict, px, same, task, typeAlong } from '../builders';

/** Shellby's detective case: a project with notes, code, logs and a buried treasure map. */
const SERVER_LOG = [
  '08:00 server started',
  '08:01 user sam logged in',
  '08:02 user alex logged in',
  '08:05 ERROR disk almost full',
  '08:06 user kim logged in',
  '08:09 user sam logged out',
  '08:12 WARNING slow response',
  '08:15 ERROR shell not found',
  '08:20 user alex logged out',
  '08:31 backup finished',
  '08:45 user kim logged out',
  '09:00 server stopped',
].join('\n') + '\n';

const caseFiles: SeedState = {
  files: {
    'notes.txt': "Shellby's notes\nTODO: buy kelp\nCall mom\nTODO: polish shell\n",
    'shopping.txt': 'Kelp chips\nsea salt\nKELP flakes\nkelp\n',
    'app.js': 'const shell = "big";\n// TODO: fix the crab bug\nconsole.log(shell);\n',
    'src/crab.js': '// TODO: make crab faster\nexport const speed = 1;\n',
    'src/shell.js': 'export const size = "large";\n',
    'logs/server.log': SERVER_LOG,
    'logs/old/2025.log': 'ancient history\n',
    'beach/rocks/cave/treasure.map': 'X marks the spot.\n',
    'beach/shells.txt': 'conch\nwhelk\n',
  },
};

const seed = (cwd?: string): PerOs<SeedState> => same(cwd === undefined ? caseFiles : { ...caseFiles, cwd });

const shows = (text: string, notText: string): PerOs<Goal> =>
  same({ kind: 'all', goals: [{ kind: 'stdoutIncludes', text }, { kind: 'stdoutExcludes', text: notText }] });

// ---------------------------------------------------------------------------
// Lesson 1: Search inside files (grep, grep -r)
// ---------------------------------------------------------------------------

export const unit3Lesson1: Lesson = {
  id: 'u3-l1',
  title: 'Search inside files',
  challenges: [
    learn({
      id: 'u3-l1-c1',
      teaches: ['grep'],
      seed: seed(),
      card: px(
        {
          title: 'grep: search inside a file',
          body: '`grep` looks through a file and prints **only the lines that contain** your word. Word first, then the file.',
          example: 'grep TODO notes.txt',
        },
        {
          title: 'Select-String: search inside a file',
          body: '`Select-String` looks through a file and prints **only the lines that contain** your word, with the file name and line number in front. Word first, then the file.',
          example: 'Select-String TODO notes.txt',
        },
      ),
    }),
    typeAlong({
      id: 'u3-l1-c2',
      uses: ['grep'],
      prompt: same('Find the to-dos in Shellby\'s notes.'),
      seed: seed(),
      goal: shows('polish shell', 'Call mom'),
      line: px('grep TODO notes.txt', 'Select-String TODO notes.txt'),
      explain: same('Two lines out of four. "Call mom" was skipped because it has no TODO in it.'),
    }),
    pick({
      id: 'u3-l1-c3',
      uses: ['grep', 'cat'],
      prompt: same('Which command prints only the lines of server.log that contain ERROR?'),
      options: px(
        ['cat ERROR server.log', 'grep ERROR server.log', 'grep server.log ERROR'],
        ['Get-Content ERROR server.log', 'Select-String ERROR server.log', 'Select-String server.log ERROR'],
      ),
      answer: same(1),
      reasons: px(
        ['`cat` prints whole files. It would look for a file called ERROR.', 'Right: the word, then the file.', 'Backwards: this searches for "server.log" in a file called ERROR.'],
        ['`Get-Content` prints whole files, and takes no search word.', 'Right: the word, then the file.', 'Backwards: this searches for "server.log" in a file called ERROR.'],
      ),
      explain: same('The word to search for always comes first.'),
    }),
    task({
      id: 'u3-l1-c4',
      uses: ['grep'],
      openHint: true,
      prompt: same('You are in the logs folder. The server had problems today. Show only the ERROR lines of server.log.'),
      seed: seed('logs'),
      goal: shows('shell not found', 'logged in'),
      solutions: px([['grep ERROR server.log']], [['Select-String ERROR server.log'], ['sls ERROR server.log']]),
      hints: px(['Search for the word ERROR in server.log.', 'Type `grep ERROR server.log`.'], ['Search for the word ERROR in server.log.', 'Type `Select-String ERROR server.log`.']),
      explain: same('Two errors: the disk was almost full, and a shell went missing. Very suspicious.'),
    }),
    task({
      id: 'u3-l1-c5',
      uses: ['cd', 'ls'],
      review: true,
      prompt: same('Go into the src folder and see what is there.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'cwdIs', path: 'src' }, { kind: 'stdoutIncludes', text: 'crab.js' }] }),
      solutions: px([['cd src', 'ls']], [['cd src', 'Get-ChildItem'], ['cd src', 'ls']]),
      hints: px(['Two commands: move, then list.', 'Type `cd src`, then `ls`.'], ['Two commands: move, then list.', 'Type `cd src`, then `Get-ChildItem`.']),
      explain: same('Two code files: crab.js and shell.js.'),
    }),
    learn({
      id: 'u3-l1-c6',
      teaches: ['grep-r'],
      uses: ['grep'],
      seed: seed(),
      card: px(
        {
          title: 'grep -r: search everywhere',
          body: '`-r` (**r**ecursive) makes grep search every file in every folder. The `.` means "start here". Each line now starts with the file it came from.',
          example: 'grep -r TODO .',
        },
        {
          title: 'Search every file',
          body: '`Get-ChildItem -Recurse` lists every file in every folder, and the `|` (a **pipe**) hands that list to `Select-String`. You will meet pipes properly in Unit 4.',
          example: 'Get-ChildItem -Recurse | Select-String TODO',
        },
      ),
    }),
    build({
      id: 'u3-l1-c7',
      uses: ['grep-r'],
      prompt: same('Build the command that finds every TODO in the whole project.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'stdoutIncludes', text: 'make crab faster' }, { kind: 'stdoutIncludes', text: 'fix the crab bug' }] }),
      tokens: px(['TODO', 'cat', '-r', '.', 'grep', '-a'], ['TODO', '-Force', 'Select-String', '|', '-Recurse', 'Get-ChildItem']),
      solutions: px([['grep -r TODO .']], [['Get-ChildItem -Recurse | Select-String TODO']]),
      hints: px(['Command, flag, word, where.'], ['List everything, pipe it, search it.']),
      explain: same('Four to-dos across three files. Shellby has been busy not doing things.'),
    }),
    match({
      id: 'u3-l1-c8',
      uses: ['grep', 'grep-r', 'cat', 'ls'],
      pairs: px(
        [
          ['grep', 'Search inside a file'],
          ['grep -r', 'Search every file, every folder'],
          ['cat', 'Print a whole file'],
          ['ls', 'List what is here'],
        ],
        [
          ['Select-String', 'Search inside a file'],
          ['Get-ChildItem -Recurse', 'List every file, every folder'],
          ['Get-Content', 'Print a whole file'],
          ['Get-ChildItem', 'List what is here'],
        ],
      ),
      explain: same('Searching is just reading, with a filter.'),
    }),
    task({
      id: 'u3-l1-c9',
      uses: ['grep-r'],
      prompt: same('Somewhere in the project, a file mentions the word large. Which file is it?'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: 'shell.js:' }),
      solutions: px([['grep -r large .'], ['grep -r large']], [['Get-ChildItem -Recurse | Select-String large']]),
      hints: px(['Search everywhere, starting here.', 'Type `grep -r large .`.'], ['List everything and pipe it into a search.', 'Type `Get-ChildItem -Recurse | Select-String large`.']),
      explain: same('It is src/shell.js. The name in front of each line tells you where it lives.'),
    }),
    pick({
      id: 'u3-l1-c10',
      uses: ['ls-a'],
      review: true,
      prompt: same('Which command also lists hidden files?'),
      options: px(['ls -a', 'grep -a', 'ls hidden'], ['Get-ChildItem -Hidden-Too', 'Get-ChildItem -Force', 'Select-String -Force']),
      answer: px(0, 1),
      reasons: px(
        ['Right.', 'That is a grep flag with a different meaning.', 'That looks for a folder called hidden.'],
        ['Not a real parameter.', 'Right.', 'That searches inside files.'],
      ),
      explain: px('`ls -a` lists all files, hidden ones too.', '`Get-ChildItem -Force` lists hidden files too.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Find files (find, head and tail)
// ---------------------------------------------------------------------------

export const unit3Lesson2: Lesson = {
  id: 'u3-l2',
  title: 'Find files',
  challenges: [
    learn({
      id: 'u3-l2-c1',
      teaches: ['find'],
      seed: seed(),
      card: px(
        {
          title: 'find: search for files by name',
          body: '`grep` searches *inside* files. `find` searches for the files themselves. `-name` gives the name to look for, and `*` is a **wildcard** that matches anything.',
          example: 'find . -name "*.log"',
        },
        {
          title: 'Find files by name',
          body: '`Get-ChildItem -Recurse` looks in every folder, and `-Filter` keeps only names that match. `*` is a **wildcard** that matches anything.',
          example: 'Get-ChildItem -Recurse -Filter *.log',
        },
      ),
    }),
    typeAlong({
      id: 'u3-l2-c2',
      uses: ['find'],
      prompt: same('Find every log file in the project.'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: '2025.log' }),
      line: px('find . -name "*.log"', 'Get-ChildItem -Recurse -Filter *.log'),
      explain: same('Two log files, one of them hiding in logs/old.'),
    }),
    pick({
      id: 'u3-l2-c3',
      uses: ['find', 'grep'],
      prompt: same('You know a file is called recipe.txt, but not which folder it is in. Which tool do you need?'),
      options: px(['grep', 'find', 'cat'], ['Select-String', 'Get-Content', 'Get-ChildItem -Recurse -Filter']),
      answer: px(1, 2),
      reasons: px(
        ['grep searches what is *inside* files.', 'Right: find looks for files by name.', 'cat needs to know exactly where the file is.'],
        ['That searches what is *inside* files.', 'That needs to know exactly where the file is.', 'Right: it looks for files by name, in every folder.'],
      ),
      explain: same('Know the words inside? Search inside. Know the name? Find the file.'),
    }),
    task({
      id: 'u3-l2-c4',
      uses: ['find'],
      openHint: true,
      prompt: same('Shellby buried a file called treasure.map somewhere. Find out which folder it is in.'),
      seed: seed(),
      goal: px({ kind: 'stdoutIncludes', text: 'cave/treasure.map' }, { kind: 'stdoutIncludes', text: 'rocks\\cave' }),
      solutions: px([['find . -name treasure.map'], ['find . -name "*.map"']], [['Get-ChildItem -Recurse -Filter treasure.map'], ['Get-ChildItem -Recurse -Filter *.map']]),
      hints: px(['Search by name, starting here.', 'Type `find . -name treasure.map`.'], ['List everything, filtered by name.', 'Type `Get-ChildItem -Recurse -Filter treasure.map`.']),
      explain: same('beach, then rocks, then cave. Three folders deep. Classic Shellby.'),
    }),
    task({
      id: 'u3-l2-c5',
      uses: ['grep'],
      review: true,
      prompt: same('Show only the WARNING lines of logs/server.log.'),
      seed: seed(),
      goal: shows('slow response', 'logged in'),
      solutions: px([['grep WARNING logs/server.log']], [['Select-String WARNING logs\\server.log'], ['Select-String WARNING logs/server.log']]),
      hints: px(['Search for WARNING inside the file.', 'Type `grep WARNING logs/server.log`.'], ['Search for WARNING inside the file.', 'Type `Select-String WARNING logs\\server.log`.']),
      explain: same('One warning: a slow response at 08:12.'),
    }),
    learn({
      id: 'u3-l2-c6',
      teaches: ['head-tail'],
      uses: ['cat'],
      seed: seed(),
      card: px(
        {
          title: 'head and tail: just the start or end',
          body: 'Long files scroll away. `head` shows the first lines and `tail` the last ones. `-n 3` says how many.',
          example: 'head -n 3 logs/server.log',
        },
        {
          title: 'Just the start or the end',
          body: 'Long files scroll away. `Get-Content` can stop early: `-TotalCount 3` shows the first 3 lines, and `-Tail 3` the last 3.',
          example: 'Get-Content logs\\server.log -TotalCount 3',
        },
      ),
    }),
    fill({
      id: 'u3-l2-c7',
      uses: ['head-tail'],
      prompt: same('Show the last 2 lines of the server log.'),
      seed: seed(),
      goal: shows('server stopped', 'server started'),
      template: px('___ -n 2 logs/server.log', 'Get-Content logs\\server.log ___ 2'),
      options: px(['head', 'tail', 'cat', 'grep'], ['-TotalCount', '-Tail', '-Skip', '-Count']),
      answer: same(1),
      hints: px(['The *end* of an animal is its...'], ['You want the end of the file.']),
      explain: same('The tail end of the log: kim logged out, then the server stopped.'),
    }),
    predict({
      id: 'u3-l2-c8',
      uses: ['head-tail'],
      prompt: same('What does this print?'),
      seed: seed(),
      command: px(['head -n 1 logs/server.log'], ['Get-Content logs\\server.log -TotalCount 1']),
      options: same(['09:00 server stopped', '08:00 server started', '08:01 user sam logged in']),
      answer: same(1),
      hints: same(['One line, from the top.']),
      explain: same('The very first line: the server starting up.'),
    }),
    task({
      id: 'u3-l2-c9',
      uses: ['head-tail'],
      prompt: same('What was the very last thing the server did? Show only the last line of logs/server.log.'),
      seed: seed(),
      goal: shows('server stopped', 'backup finished'),
      solutions: px([['tail -n 1 logs/server.log'], ['tail -1 logs/server.log']], [['Get-Content logs\\server.log -Tail 1'], ['Get-Content logs/server.log -Tail 1']]),
      hints: px(['The end of the file, just one line.', 'Type `tail -n 1 logs/server.log`.'], ['The end of the file, just one line.', 'Type `Get-Content logs\\server.log -Tail 1`.']),
      explain: same('It stopped at 09:00. Case closed? Not yet.'),
    }),
    match({
      id: 'u3-l2-c10',
      uses: ['grep', 'find', 'head-tail'],
      review: true,
      pairs: px(
        [
          ['grep', 'Search inside files'],
          ['find', 'Search for files by name'],
          ['head', 'First lines of a file'],
          ['tail', 'Last lines of a file'],
        ],
        [
          ['Select-String', 'Search inside files'],
          ['-Filter', 'Search for files by name'],
          ['-TotalCount', 'First lines of a file'],
          ['-Tail', 'Last lines of a file'],
        ],
      ),
      explain: same('Four ways to stop scrolling and start finding.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: Count and compare (wc, grep -i)
// ---------------------------------------------------------------------------

export const unit3Lesson3: Lesson = {
  id: 'u3-l3',
  title: 'Count and compare',
  challenges: [
    learn({
      id: 'u3-l3-c1',
      teaches: ['wc'],
      uses: ['cat'],
      seed: seed(),
      card: px(
        { title: 'wc -l: count lines', body: '`wc` (**w**ord **c**ount) counts a file. With `-l` it counts just the **l**ines, and prints the number before the name.', example: 'wc -l notes.txt' },
        {
          title: 'Count lines',
          body: '`Get-Content` reads the lines, the `|` pipe hands them over, and `Measure-Object -Line` counts them.',
          example: 'Get-Content notes.txt | Measure-Object -Line',
        },
      ),
    }),
    typeAlong({
      id: 'u3-l3-c2',
      uses: ['wc'],
      prompt: same('How long is the server log?'),
      seed: seed(),
      goal: same({ kind: 'stdoutIncludes', text: '12' }),
      line: px('wc -l logs/server.log', 'Get-Content logs\\server.log | Measure-Object -Line'),
      explain: same('12 lines. Small for a log; real ones run to millions.'),
    }),
    pick({
      id: 'u3-l3-c3',
      uses: ['wc'],
      prompt: px('What does `wc -l notes.txt` count?', 'What does `Measure-Object -Line` count?'),
      options: same(['The lines', 'The letters', 'The files']),
      answer: same(0),
      reasons: same(['Right.', 'Close: counting characters is a different flag.', 'It counts inside one file.']),
      explain: px('`-l` for lines.', '`-Line` for lines.'),
    }),
    task({
      id: 'u3-l3-c4',
      uses: ['find'],
      review: true,
      prompt: same('Find every .txt file in the project.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'stdoutIncludes', text: 'shells.txt' }, { kind: 'stdoutIncludes', text: 'notes.txt' }] }),
      solutions: px([['find . -name "*.txt"']], [['Get-ChildItem -Recurse -Filter *.txt']]),
      hints: px(['Use the wildcard: any name ending in .txt.', 'Type `find . -name "*.txt"`.'], ['Use the wildcard: any name ending in .txt.', 'Type `Get-ChildItem -Recurse -Filter *.txt`.']),
      explain: same('Three text files, one of them out on the beach.'),
    }),
    learn({
      id: 'u3-l3-c5',
      teaches: ['grep-i'],
      uses: ['grep'],
      seed: seed(),
      card: px(
        {
          title: 'grep -i: ignore capitals',
          body: 'grep is fussy: `kelp`, `Kelp` and `KELP` are different words to it. `-i` (**i**gnore case) finds them all.',
          example: 'grep -i kelp shopping.txt',
        },
        {
          title: 'Capitals and Select-String',
          body: '`Select-String` already ignores capitals: `kelp` finds `Kelp` and `KELP` too. Add `-CaseSensitive` when you want an exact match.',
          example: 'Select-String kelp shopping.txt',
        },
      ),
    }),
    build({
      id: 'u3-l3-c6',
      uses: ['grep-i'],
      prompt: same('Show every kelp line in shopping.txt, however it is written: kelp, Kelp or KELP.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'stdoutIncludes', text: 'KELP flakes' }, { kind: 'stdoutIncludes', text: 'Kelp chips' }, { kind: 'stdoutExcludes', text: 'sea salt' }] }),
      tokens: px(['-i', 'shopping.txt', 'cat', 'kelp', 'grep', '-r'], ['shopping.txt', '-CaseSensitive', 'kelp', 'Get-Content', 'Select-String']),
      solutions: px([['grep -i kelp shopping.txt']], [['Select-String kelp shopping.txt']]),
      hints: px(['Command, flag, word, file.'], ['Leave out the strict parameter.']),
      explain: same('All three kelps, no sea salt.'),
    }),
    predict({
      id: 'u3-l3-c7',
      uses: ['wc'],
      prompt: same('notes.txt has four lines. What does this print?'),
      seed: seed(),
      command: px(['wc -l notes.txt'], ['Get-Content notes.txt | Measure-Object -Line']),
      options: px(['notes.txt 4', '4 notes.txt', '4 lines'], ['4 lines', 'notes.txt: 4', '4']),
      answer: px(1, 2),
      hints: same(['The number comes first.']),
      explain: px('wc prints the count, then the file name.', 'Measure-Object prints a small table, and the count sits under Lines.'),
    }),
    match({
      id: 'u3-l3-c8',
      uses: ['wc', 'grep-i', 'find', 'head-tail'],
      pairs: px(
        [
          ['wc -l', 'Count lines'],
          ['grep -i', 'Search, ignoring capitals'],
          ['find -name', 'Find files by name'],
          ['tail', 'Last lines of a file'],
        ],
        [
          ['Measure-Object -Line', 'Count lines'],
          ['-CaseSensitive', 'Search, minding capitals'],
          ['-Filter', 'Find files by name'],
          ['-Tail', 'Last lines of a file'],
        ],
      ),
      explain: same('That is the whole detective kit.'),
    }),
    task({
      id: 'u3-l3-c9',
      uses: ['grep-i'],
      prompt: same('Did anything go wrong on the server? Search logs/server.log for the word error, in any capitals.'),
      seed: seed(),
      goal: shows('disk almost full', 'logged in'),
      solutions: px([['grep -i error logs/server.log'], ['grep ERROR logs/server.log']], [['Select-String error logs\\server.log'], ['Select-String ERROR logs/server.log']]),
      hints: px(['The log writes it in capitals. Ignore case.', 'Type `grep -i error logs/server.log`.'], ['Select-String does not mind capitals.', 'Type `Select-String error logs\\server.log`.']),
      explain: same('Two errors. Somebody should look at that disk.'),
    }),
    task({
      id: 'u3-l3-c10',
      uses: ['grep-r'],
      review: true,
      prompt: same('Last check: find every TODO in the whole project.'),
      seed: seed(),
      goal: same({ kind: 'all', goals: [{ kind: 'stdoutIncludes', text: 'make crab faster' }, { kind: 'stdoutIncludes', text: 'buy kelp' }] }),
      solutions: px([['grep -r TODO .'], ['grep -r TODO']], [['Get-ChildItem -Recurse | Select-String TODO']]),
      hints: px(['Search everywhere, starting here.', 'Type `grep -r TODO .`.'], ['List everything, then search it.', 'Type `Get-ChildItem -Recurse | Select-String TODO`.']),
      explain: same('Four to-dos. Shellby says they are "aspirational".'),
    }),
  ],
};

export const unit3: Unit = {
  id: 'u3',
  title: 'Finding things',
  blurb: 'Search inside files, find files by name, and count what you find.',
  lessons: [unit3Lesson1, unit3Lesson2, unit3Lesson3],
};
