import type { SeedState } from '../../domain/machine';
import type { Goal, Lesson, PerOs, Unit } from '../../domain/lessons/types';
import { build, fill, learn, match, pick, predict, px, same, task, typeAlong } from '../builders';

/** The tidepool: Herme counts visitors and keeps an eye on the server. */
const SERVER_LOG =
  [
    '08:00 server started',
    '08:04 ERROR disk almost full',
    '08:10 user sam logged in',
    '08:12 WARNING slow response',
    '08:15 ERROR shell not found',
    '08:20 user sam logged out',
    '08:31 backup finished',
    '08:40 ERROR crab escaped',
    '08:45 user kim logged in',
    '09:00 server stopped',
  ].join('\n') + '\n';

const tidepool: SeedState = {
  files: {
    'visitors.txt': 'crab\nfish\ncrab\nsnail\nfish\ncrab\nstarfish\n',
    'logs/server.log': SERVER_LOG,
    'photos/beach.png': 'png',
    'photos/crab.png': 'png',
    'photos/sunset.png': 'png',
    'photos/wave.png': 'png',
  },
};

const withErrors: SeedState = { files: { ...tidepool.files, 'errors.txt': '08:04 ERROR disk almost full\n' } };

const seed = same(tidepool);
const SORTED = 'crab\ncrab\ncrab\nfish\nfish\nsnail\nstarfish';

const all = (...goals: Goal[]): PerOs<Goal> => same({ kind: 'all', goals });
const out = (text: string): Goal => ({ kind: 'stdoutIncludes', text });
const notOut = (text: string): Goal => ({ kind: 'stdoutExcludes', text });
const file = (path: string, text: string): Goal => ({ kind: 'fileContains', path, text });

// ---------------------------------------------------------------------------
// Lesson 1: Pipes (pipe, sort)
// ---------------------------------------------------------------------------

export const unit4Lesson1: Lesson = {
  id: 'u4-l1',
  title: 'Pipes',
  challenges: [
    learn({
      id: 'u4-l1-c1',
      teaches: ['pipe'],
      uses: ['cat', 'grep'],
      seed,
      card: px(
        {
          title: 'The pipe: |',
          body: 'The `|` key (a **pipe**) takes what one command prints and feeds it into the next one, instead of the screen. Here `cat` reads the file, and `grep` keeps only the crab lines.',
          example: 'cat visitors.txt | grep crab',
        },
        {
          title: 'The pipe: |',
          body: 'The `|` key (a **pipe**) takes what one command outputs and feeds it into the next one. Here `Get-Content` reads the file, and `Select-String` keeps only the crab lines. PowerShell pipes whole **objects**, not just text, so the next command still knows each item\'s details.',
          example: 'Get-Content visitors.txt | Select-String crab',
        },
      ),
    }),
    typeAlong({
      id: 'u4-l1-c2',
      uses: ['pipe'],
      prompt: same('Read the visitor list and keep only the crabs.'),
      seed,
      goal: all(out('crab'), notOut('fish')),
      line: px('cat visitors.txt | grep crab', 'Get-Content visitors.txt | Select-String crab'),
      explain: same('Three crabs. The first command never printed to the screen: its output went down the pipe.'),
    }),
    pick({
      id: 'u4-l1-c3',
      uses: ['pipe'],
      prompt: same('What does the | in a command do?'),
      options: same(['Sends one command\'s output into the next command', 'Saves the output to a file', 'Runs two commands at the same time, side by side']),
      answer: same(0),
      reasons: same(['Right: output in one end, out the other.', 'That is a different symbol, coming up next lesson.', 'They are joined: the second one reads what the first one prints.']),
      explain: same('Think of a real pipe: what comes out of the first command flows into the second.'),
    }),
    task({
      id: 'u4-l1-c4',
      uses: ['pipe', 'grep', 'wc'],
      openHint: true,
      prompt: same('How many ERROR lines are in logs/server.log? Print just the number, not the lines.'),
      seed,
      goal: all(out('3'), notOut('ERROR')),
      solutions: px(
        [['grep ERROR logs/server.log | wc -l'], ['cat logs/server.log | grep ERROR | wc -l']],
        [['Select-String ERROR logs\\server.log | Measure-Object'], ['Get-Content logs\\server.log | Select-String ERROR | Measure-Object']],
      ),
      hints: px(
        ['Find the ERROR lines, then pipe them into a line counter.', 'Type `grep ERROR logs/server.log | wc -l`.'],
        ['Find the ERROR lines, then pipe them into Measure-Object to count them.', 'Type `Select-String ERROR logs\\server.log | Measure-Object`.'],
      ),
      explain: px('3 errors. `wc -l` counted the lines grep handed it.', '3 errors. Measure-Object counted the matches Select-String handed it.'),
    }),
    task({
      id: 'u4-l1-c5',
      uses: ['find'],
      review: true,
      prompt: same('Find every .png file in the project.'),
      seed,
      goal: all(out('sunset.png'), out('crab.png')),
      solutions: px([['find . -name "*.png"']], [['Get-ChildItem -Recurse -Filter *.png']]),
      hints: px(['Search by name with a wildcard.', 'Type `find . -name "*.png"`.'], ['List everything, filtered by name.', 'Type `Get-ChildItem -Recurse -Filter *.png`.']),
      explain: same('Four photos, all in the photos folder.'),
    }),
    learn({
      id: 'u4-l1-c6',
      teaches: ['sort'],
      uses: ['pipe'],
      seed,
      card: px(
        {
          title: 'sort: put lines in order',
          body: '`sort` prints a file\'s lines in alphabetical order. It does not change the file, it only changes what you see.',
          example: 'sort visitors.txt',
        },
        {
          title: 'Sort-Object: put things in order',
          body: 'Pipe anything into `Sort-Object` and it comes out in order. It does not change the file, it only changes what you see.',
          example: 'Get-Content visitors.txt | Sort-Object',
        },
      ),
    }),
    fill({
      id: 'u4-l1-c7',
      uses: ['sort', 'pipe'],
      prompt: same('Show the visitors in alphabetical order.'),
      seed,
      goal: same(out(SORTED)),
      template: px('cat visitors.txt | ___', 'Get-Content visitors.txt | ___'),
      options: px(['wc', 'sort', 'grep', 'head'], ['Measure-Object', 'Sort-Object', 'Select-String', 'Set-Content']),
      answer: same(1),
      hints: same(['Which one puts things in order?']),
      explain: same('All the crabs line up together now, then the fish.'),
    }),
    predict({
      id: 'u4-l1-c8',
      uses: ['pipe', 'grep'],
      prompt: same('What does this print?'),
      seed,
      command: px(['cat visitors.txt | grep star'], ['Get-Content visitors.txt | Select-String star']),
      options: same(['star', 'starfish', 'crab']),
      answer: same(1),
      hints: same(['The search prints whole lines, not just the bit that matched.']),
      explain: same('Searches always print the whole matching line.'),
    }),
    match({
      id: 'u4-l1-c9',
      uses: ['pipe', 'sort', 'grep', 'wc'],
      pairs: px(
        [
          ['|', 'Feed output into the next command'],
          ['sort', 'Put lines in order'],
          ['grep', 'Keep matching lines'],
          ['wc -l', 'Count lines'],
        ],
        [
          ['|', 'Feed output into the next command'],
          ['Sort-Object', 'Put things in order'],
          ['Select-String', 'Keep matching lines'],
          ['Measure-Object', 'Count things'],
        ],
      ),
      explain: same('Small tools, joined with pipes. That is the whole trick of the terminal.'),
    }),
    task({
      id: 'u4-l1-c10',
      uses: ['sort'],
      prompt: same('Herme wants the visitor list in order. Show it sorted.'),
      seed,
      goal: same(out(SORTED)),
      solutions: px([['sort visitors.txt'], ['cat visitors.txt | sort']], [['Get-Content visitors.txt | Sort-Object']]),
      hints: px(['One command, one file.', 'Type `sort visitors.txt`.'], ['Read it, then pipe it into the sorter.', 'Type `Get-Content visitors.txt | Sort-Object`.']),
      explain: same('Crab, crab, crab. Popular spot.'),
    }),
    task({
      id: 'u4-l1-c11',
      uses: ['head-tail'],
      review: true,
      prompt: same('What was the last thing in the server log? Show only its last line.'),
      seed,
      goal: all(out('server stopped'), notOut('kim')),
      solutions: px([['tail -n 1 logs/server.log']], [['Get-Content logs\\server.log -Tail 1']]),
      hints: px(['The end of the file, one line.', 'Type `tail -n 1 logs/server.log`.'], ['The end of the file, one line.', 'Type `Get-Content logs\\server.log -Tail 1`.']),
      explain: same('The server stopped at 09:00.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Save output (redirect, append)
// ---------------------------------------------------------------------------

export const unit4Lesson2: Lesson = {
  id: 'u4-l2',
  title: 'Save output',
  challenges: [
    learn({
      id: 'u4-l2-c1',
      teaches: ['redirect'],
      uses: ['grep'],
      seed,
      card: px(
        {
          title: 'Save output with >',
          body: '`>` sends what a command prints **into a file** instead of the screen. If the file exists, it is **replaced**. Nothing prints, because it all went into the file.',
          example: 'grep ERROR logs/server.log > errors.txt',
        },
        {
          title: 'Save output with >',
          body: '`>` sends what a command outputs **into a file** instead of the screen. If the file exists, it is **replaced**. Nothing prints, because it all went into the file.',
          example: 'Select-String ERROR logs\\server.log > errors.txt',
        },
      ),
    }),
    typeAlong({
      id: 'u4-l2-c2',
      uses: ['redirect'],
      prompt: same('Save the ERROR lines into a new file called errors.txt.'),
      seed,
      goal: same(file('errors.txt', 'crab escaped')),
      line: px('grep ERROR logs/server.log > errors.txt', 'Select-String ERROR logs\\server.log > errors.txt'),
      explain: same('Nothing printed, and that is the point: the lines are in errors.txt now.'),
    }),
    pick({
      id: 'u4-l2-c3',
      uses: ['redirect'],
      prompt: same('You run a command with > at the end. Where does its output go?'),
      options: same(['Into the file, and nothing shows on screen', 'On screen, and also into the file', 'Nowhere: > throws it away']),
      answer: same(0),
      reasons: same(['Right.', 'It goes only into the file. To see it, open the file.', 'It is kept, just in the file.']),
      explain: same('To check what was saved, print the file.'),
    }),
    task({
      id: 'u4-l2-c4',
      uses: ['redirect', 'sort'],
      openHint: true,
      prompt: same('Save the visitor list, sorted, into a new file called sorted.txt.'),
      seed,
      goal: same(file('sorted.txt', SORTED)),
      solutions: px([['sort visitors.txt > sorted.txt']], [['Get-Content visitors.txt | Sort-Object > sorted.txt']]),
      hints: px(['Sort the file, then send the result into sorted.txt.', 'Type `sort visitors.txt > sorted.txt`.'], ['Sort it, then send the result into sorted.txt.', 'Type `Get-Content visitors.txt | Sort-Object > sorted.txt`.']),
      explain: same('visitors.txt is unchanged. sorted.txt holds the tidy copy.'),
    }),
    task({
      id: 'u4-l2-c5',
      uses: ['grep-i'],
      review: true,
      prompt: same('Search visitors.txt for CRAB, in capitals. It should still find the crabs.'),
      seed,
      goal: all(out('crab'), notOut('fish')),
      solutions: px([['grep -i CRAB visitors.txt']], [['Select-String CRAB visitors.txt']]),
      hints: px(['Tell grep to ignore capitals.', 'Type `grep -i CRAB visitors.txt`.'], ['Select-String ignores capitals already.', 'Type `Select-String CRAB visitors.txt`.']),
      explain: same('Capitals ignored, crabs found.'),
    }),
    learn({
      id: 'u4-l2-c6',
      teaches: ['append'],
      uses: ['redirect'],
      seed: same(withErrors),
      card: px(
        {
          title: 'Add to a file with >>',
          body: '`>` replaces a file. `>>` (two arrows) **adds to the end** and keeps what was already there.',
          example: 'grep WARNING logs/server.log >> errors.txt',
        },
        {
          title: 'Add to a file with >>',
          body: '`>` replaces a file. `>>` (two arrows) **adds to the end** and keeps what was already there.',
          example: 'Select-String WARNING logs\\server.log >> errors.txt',
        },
      ),
    }),
    predict({
      id: 'u4-l2-c7',
      uses: ['redirect', 'cat'],
      prompt: same('errors.txt holds one line: 08:04 ERROR disk almost full. What does it hold after these two commands?'),
      seed: same(withErrors),
      command: px(['grep WARNING logs/server.log > errors.txt', 'cat errors.txt'], ['Select-String WARNING logs\\server.log > errors.txt', 'Get-Content errors.txt']),
      options: px(
        ['08:12 WARNING slow response', '08:04 ERROR disk almost full', 'errors.txt'],
        ['logs\\server.log:4:08:12 WARNING slow response', '08:04 ERROR disk almost full', 'errors.txt'],
      ),
      answer: same(0),
      hints: same(['One arrow replaces the whole file.']),
      explain: same('The old error line is gone. One arrow replaced the file. That is why `>>` exists.'),
    }),
    fill({
      id: 'u4-l2-c8',
      uses: ['append'],
      prompt: same('Add the WARNING lines to errors.txt, keeping the error already in it.'),
      seed: same(withErrors),
      goal: all(file('errors.txt', 'disk almost full'), file('errors.txt', 'slow response')),
      template: px('grep WARNING logs/server.log ___ errors.txt', 'Select-String WARNING logs\\server.log ___ errors.txt'),
      options: same(['>', '>>', '|', '&&']),
      answer: same(1),
      hints: same(['One arrow replaces. Two arrows add.']),
      explain: same('Both lines are in errors.txt now.'),
    }),
    match({
      id: 'u4-l2-c9',
      uses: ['redirect', 'append', 'pipe', 'sort'],
      pairs: px(
        [
          ['>', 'Save into a file, replacing it'],
          ['>>', 'Add to the end of a file'],
          ['|', 'Feed into the next command'],
          ['sort', 'Put lines in order'],
        ],
        [
          ['>', 'Save into a file, replacing it'],
          ['>>', 'Add to the end of a file'],
          ['|', 'Feed into the next command'],
          ['Sort-Object', 'Put things in order'],
        ],
      ),
      explain: same('Arrows point into files. Pipes point into commands.'),
    }),
    task({
      id: 'u4-l2-c10',
      uses: ['append'],
      prompt: same('The backup finished, and Herme wants that on record too. Add the backup line from logs/server.log to errors.txt without losing what is there.'),
      seed: same(withErrors),
      goal: all(file('errors.txt', 'disk almost full'), file('errors.txt', 'backup finished')),
      solutions: px([['grep backup logs/server.log >> errors.txt']], [['Select-String backup logs\\server.log >> errors.txt']]),
      hints: px(['Search for backup, then add it with two arrows.', 'Type `grep backup logs/server.log >> errors.txt`.'], ['Search for backup, then add it with two arrows.', 'Type `Select-String backup logs\\server.log >> errors.txt`.']),
      explain: same('Two lines in errors.txt, nothing lost.'),
    }),
    task({
      id: 'u4-l2-c11',
      uses: ['wc'],
      review: true,
      prompt: same('How many lines does visitors.txt have?'),
      seed,
      goal: same(out('7')),
      solutions: px([['wc -l visitors.txt']], [['Get-Content visitors.txt | Measure-Object -Line']]),
      hints: px(['Count the lines.', 'Type `wc -l visitors.txt`.'], ['Read the file and pipe it into a line counter.', 'Type `Get-Content visitors.txt | Measure-Object -Line`.']),
      explain: same('7 visitors today.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: Chain and count (chain, count)
// ---------------------------------------------------------------------------

export const unit4Lesson3: Lesson = {
  id: 'u4-l3',
  title: 'Chain and count',
  challenges: [
    learn({
      id: 'u4-l3-c1',
      teaches: ['chain'],
      uses: ['mkdir', 'cd'],
      seed,
      card: same({
        title: 'Run one thing, then another: &&',
        body: '`&&` joins two commands. The second one runs **only if the first one worked**. Here, `cd` only happens if the folder was made.',
        example: 'mkdir trip && cd trip',
      }),
    }),
    typeAlong({
      id: 'u4-l3-c2',
      uses: ['chain'],
      prompt: same('Make a folder called trip and step into it, in one line.'),
      seed,
      goal: same({ kind: 'cwdIs', path: 'trip' }),
      line: same('mkdir trip && cd trip'),
      explain: same('Two commands, one Enter.'),
    }),
    pick({
      id: 'u4-l3-c3',
      uses: ['chain'],
      prompt: same('There is no folder called nowhere. What happens when you run cd nowhere && ls ?'),
      options: same(['cd fails, so ls never runs', 'cd fails, but ls runs anyway', 'Both run at the same time']),
      answer: same(0),
      reasons: same(['Right: && stops at the first failure.', 'That is what `;` does. `&&` waits to see if the first one worked.', 'They run in order: first, then (maybe) second.']),
      explain: same('&& is a safety catch: no point listing a folder you never got into.'),
    }),
    task({
      id: 'u4-l3-c4',
      uses: ['chain'],
      openHint: true,
      prompt: same('Make a folder called reports and go into it, in one line.'),
      seed,
      goal: same({ kind: 'cwdIs', path: 'reports' }),
      solutions: same([['mkdir reports && cd reports']]),
      hints: same(['Make it, then (if that worked) go in.', 'Type `mkdir reports && cd reports`.']),
      explain: same('You are in reports.'),
    }),
    task({
      id: 'u4-l3-c5',
      uses: ['redirect'],
      review: true,
      prompt: same('Save the ERROR lines of logs/server.log into a new file called errors.txt.'),
      seed,
      goal: same(file('errors.txt', 'shell not found')),
      solutions: px([['grep ERROR logs/server.log > errors.txt']], [['Select-String ERROR logs\\server.log > errors.txt']]),
      hints: px(['Search, then send it into a file with one arrow.', 'Type `grep ERROR logs/server.log > errors.txt`.'], ['Search, then send it into a file with one arrow.', 'Type `Select-String ERROR logs\\server.log > errors.txt`.']),
      explain: same('Saved. Nothing printed, as expected.'),
    }),
    learn({
      id: 'u4-l3-c6',
      teaches: ['count'],
      uses: ['sort', 'pipe'],
      seed,
      card: px(
        {
          title: 'Count each kind: uniq -c',
          body: '`uniq -c` squashes repeated lines into one and puts a **count** in front. It only spots repeats that sit next to each other, so `sort` them first.',
          example: 'sort visitors.txt | uniq -c',
        },
        {
          title: 'Count each kind: Group-Object',
          body: '`Group-Object` gathers equal things into groups. The **Count** column says how many are in each.',
          example: 'Get-Content visitors.txt | Group-Object',
        },
      ),
    }),
    build({
      id: 'u4-l3-c7',
      uses: ['count'],
      prompt: same('Build the command that counts each kind of visitor.'),
      seed,
      goal: same(out('3 crab')),
      tokens: px(['wc', 'uniq', '|', 'visitors.txt', '-c', 'sort', '-l'], ['Measure-Object', 'visitors.txt', 'Group-Object', '|', 'Sort-Object', 'Get-Content']),
      solutions: px([['sort visitors.txt | uniq -c']], [['Get-Content visitors.txt | Group-Object']]),
      hints: px(['Sort, pipe, then squash and count.'], ['Read, pipe, then group.']),
      explain: same('3 crabs, 2 fish, 1 snail, 1 starfish.'),
    }),
    pick({
      id: 'u4-l3-c8',
      uses: ['count'],
      prompt: px('Why does sort come before uniq -c?', 'In the Group-Object table, what does the Count column show?'),
      options: px(
        ['uniq only merges repeats that sit next to each other', 'uniq gives an error on files that are not sorted', 'sort makes uniq run faster'],
        ['How many times each thing appears', 'How many letters each thing has', 'The line number where it first appears'],
      ),
      answer: same(0),
      reasons: px(
        ['Right: sort puts the crabs side by side so uniq can count them together.', 'It gives no error. It just counts the same crab in several places.', 'Speed is not the reason. Without sort, the counts come out wrong.'],
        ['Right.', 'That would be Length.', 'Group-Object does not track line numbers.'],
      ),
      explain: px('Unsorted, uniq -c would print crab 1, fish 1, crab 1...', 'Count is the size of each group.'),
    }),
    fill({
      id: 'u4-l3-c9',
      uses: ['chain', 'redirect'],
      prompt: same('Save the sorted visitors into sorted.txt, and then, if that worked, print sorted.txt.'),
      seed,
      goal: all(out('starfish'), file('sorted.txt', SORTED)),
      template: px('sort visitors.txt > sorted.txt ___ cat sorted.txt', 'Get-Content visitors.txt | Sort-Object > sorted.txt ___ Get-Content sorted.txt'),
      options: same(['>', '&&', '>>', '||']),
      answer: same(1),
      hints: same(['You want: do this, then do that.']),
      explain: same('Saved and shown, in one line.'),
    }),
    match({
      id: 'u4-l3-c10',
      uses: ['chain', 'count', 'redirect', 'pipe'],
      pairs: px(
        [
          ['&&', 'Then, if that worked'],
          ['uniq -c', 'Count repeated lines'],
          ['>', 'Save into a file'],
          ['|', 'Feed into the next command'],
        ],
        [
          ['&&', 'Then, if that worked'],
          ['Group-Object', 'Count equal things'],
          ['>', 'Save into a file'],
          ['|', 'Feed into the next command'],
        ],
      ),
      explain: same('That is Unit 4. You can now build your own little machines out of commands.'),
    }),
    task({
      id: 'u4-l3-c11',
      uses: ['count'],
      prompt: same('Which visitor came most often? Count each kind of visitor.'),
      seed,
      goal: same(out('3 crab')),
      solutions: px(
        [['sort visitors.txt | uniq -c'], ['sort visitors.txt | uniq -c | sort -rn']],
        [['Get-Content visitors.txt | Group-Object'], ['Get-Content visitors.txt | Group-Object | Sort-Object Count -Descending']],
      ),
      hints: px(['Sort first, then count repeats.', 'Type `sort visitors.txt | uniq -c`.'], ['Read the file and group it.', 'Type `Get-Content visitors.txt | Group-Object`.']),
      explain: same('Crabs, 3 of them. Herme is not surprised.'),
    }),
    task({
      id: 'u4-l3-c12',
      uses: ['pipe', 'wc'],
      review: true,
      prompt: same('How many photos are in the photos folder? Print just the number.'),
      seed,
      goal: all(out('4'), notOut('png')),
      solutions: px([['ls photos | wc -l']], [['Get-ChildItem photos | Measure-Object']]),
      hints: px(['List the folder, pipe it into a line counter.', 'Type `ls photos | wc -l`.'], ['List the folder, pipe it into Measure-Object.', 'Type `Get-ChildItem photos | Measure-Object`.']),
      explain: same('4 photos.'),
    }),
  ],
};

export const unit4: Unit = {
  id: 'u4',
  title: 'Pipes and redirects',
  blurb: 'Join commands together, save what they print, and count things.',
  lessons: [unit4Lesson1, unit4Lesson2, unit4Lesson3],
};
