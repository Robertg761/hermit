import type { SeedState } from '../../domain/machine';
import type { Goal, Lesson, PerOs, Unit } from '../../domain/lessons/types';
import { build, fill, learn, match, pick, px, same, task, typeAlong } from '../builders';

/** Herme's computer is crawling. Something is eating the CPU. */
const busy: SeedState = {
  processes: [
    { pid: 4242, name: 'runaway', cpu: 99.2 },
    { pid: 1201, name: 'music', cpu: 1.5 },
    { pid: 1302, name: 'editor', cpu: 2.1 },
  ],
};

const HELLO_SH = '#!/bin/sh\necho "Hello from a script!"\n';
const BUILD_SH = '#!/bin/sh\nmkdir -p dist\necho "Build complete"\n';
const HELLO_PS = 'Write-Output "Hello from a script!"\n';
const BUILD_PS = 'mkdir dist\nWrite-Output "Build complete"\n';

/** Scripts already allowed to run: the learner's own computer, set up earlier. */
const ready: SeedState = {
  files: { 'hello.sh': HELLO_SH, 'build.sh': BUILD_SH, 'hello.ps1': HELLO_PS, 'build.ps1': BUILD_PS },
  executable: ['hello.sh', 'build.sh'],
  executionPolicy: 'RemoteSigned',
};

/** A fresh download on a fresh computer: nothing may run yet. */
const fresh: SeedState = { files: { 'build.sh': BUILD_SH, 'build.ps1': BUILD_PS } };

/** A stuck system updater (owned by root / SYSTEM) and a swarm of bubbles. */
const crowded: SeedState = {
  processes: [
    { pid: 666, name: 'updater', cpu: 98.7, admin: true },
    { pid: 1501, name: 'bubbles', cpu: 4.2 },
    { pid: 1502, name: 'bubbles', cpu: 3.9 },
    { pid: 1503, name: 'bubbles', cpu: 4.4 },
    { pid: 1201, name: 'music', cpu: 1.5 },
  ],
};

const all = (...goals: Goal[]): PerOs<Goal> => same({ kind: 'all', goals });
const gone = (name: string): Goal => ({ kind: 'processGone', name });
const built: PerOs<Goal> = all({ kind: 'stdoutIncludes', text: 'Build complete' }, { kind: 'exists', path: 'dist', type: 'dir' });

// ---------------------------------------------------------------------------
// Lesson 1: Stop a runaway (ps, kill)
// ---------------------------------------------------------------------------

export const unit5Lesson1: Lesson = {
  id: 'u5-l1',
  title: 'Stop a runaway',
  challenges: [
    learn({
      id: 'u5-l1-c1',
      teaches: ['ps'],
      seed: same(busy),
      card: {
        linux: {
          title: 'ps aux: see what is running',
          body: 'Every running program is a **process**. `ps aux` lists them all, like the System Monitor app. **PID** is each one\'s ID number. **%CPU** is how much of the processor (the computer\'s brain) it is using.',
          example: 'ps aux',
        },
        mac: {
          title: 'ps aux: see what is running',
          body: 'Every running program is a **process**. `ps aux` lists them all, like the Activity Monitor app. **PID** is each one\'s ID number. **%CPU** is how much of the processor (the computer\'s brain) it is using.',
          example: 'ps aux',
        },
        windows: {
          title: 'Get-Process: see what is running',
          body: 'Every running program is a **process**. `Get-Process` lists them all, like Task Manager. **Id** is each one\'s ID number. **CPU(s)** is how many seconds of work the processor (the computer\'s brain) has done for it.',
          example: 'Get-Process',
        },
      },
    }),
    typeAlong({
      id: 'u5-l1-c2',
      uses: ['ps'],
      prompt: same('Herme\'s computer is crawling. List the running processes.'),
      seed: same(busy),
      goal: same({ kind: 'stdoutIncludes', text: 'runaway' }),
      line: px('ps aux', 'Get-Process'),
      explain: px('Look at runaway: 99% of the processor, all by itself.', 'Look at runaway: 99 seconds of processor time. The others have used 2 or less.'),
    }),
    pick({
      id: 'u5-l1-c3',
      uses: ['ps'],
      prompt: same('Two processes can share a name. Which column tells them apart for sure?'),
      options: px(['PID', '%CPU', 'COMMAND'], ['Id', 'CPU(s)', 'ProcessName']),
      answer: same(0),
      reasons: px(
        ['Right: every process gets its own number.', 'Two processes can work equally hard.', 'That is the name, and names can repeat.'],
        ['Right: every process gets its own number.', 'Two processes can do the same amount of work.', 'That is the name, and names can repeat.'],
      ),
      explain: same('The ID number is unique, so it is how you point at one exact process.'),
    }),
    task({
      id: 'u5-l1-c4',
      uses: ['ps'],
      openHint: true,
      prompt: same('Which process is hogging the processor? List the processes and look.'),
      seed: same(busy),
      goal: same({ kind: 'stdoutIncludes', text: 'runaway' }),
      solutions: px([['ps aux']], [['Get-Process']]),
      hints: px(['List every process.', 'Type `ps aux`.'], ['List every process.', 'Type `Get-Process`.']),
      explain: px('runaway, PID 4242, at 99.2%. Remember that number.', 'runaway, Id 4242. Remember that number.'),
    }),
    task({
      id: 'u5-l1-c5',
      uses: ['ps', 'redirect'],
      review: true,
      prompt: same('Save the list of processes into a file called procs.txt, for the record.'),
      seed: same(busy),
      goal: same({ kind: 'fileContains', path: 'procs.txt', text: 'runaway' }),
      solutions: px([['ps aux > procs.txt']], [['Get-Process > procs.txt']]),
      hints: px(['List them, and send the list into a file with one arrow.', 'Type `ps aux > procs.txt`.'], ['List them, and send the list into a file with one arrow.', 'Type `Get-Process > procs.txt`.']),
      explain: same('Saved. Evidence for later.'),
    }),
    learn({
      id: 'u5-l1-c6',
      teaches: ['kill'],
      uses: ['ps'],
      seed: same(busy),
      card: px(
        {
          title: 'kill: stop a process',
          body: '`kill` and a PID asks that process to stop. (Despite the name, it asks politely.) Nothing prints when it works. Here, 1201 is the music player.',
          example: 'kill 1201',
        },
        {
          title: 'Stop-Process: stop a process',
          body: '`Stop-Process -Id` and an Id stops that process. Nothing prints when it works. Here, 1201 is the music player. (The short name `kill` works too.)',
          example: 'Stop-Process -Id 1201',
        },
      ),
    }),
    fill({
      id: 'u5-l1-c7',
      uses: ['kill'],
      prompt: same('Stop the runaway process. Its ID is 4242.'),
      seed: same(busy),
      goal: same(gone('runaway')),
      template: px('___ 4242', 'Stop-Process ___ 4242'),
      options: px(['ps', 'kill', 'rm', 'cd'], ['-Name', '-Id', '-Path', '-Filter']),
      answer: same(1),
      hints: px(['Which command stops a process?'], ['4242 is an ID number.']),
      explain: same('runaway is gone. The fans go quiet.'),
    }),
    pick({
      id: 'u5-l1-c8',
      uses: ['kill', 'ps'],
      prompt: px(
        '`ps aux` shows: PID 4242 runaway, PID 1201 music, PID 1302 editor. You run `kill 1302`. What stops?',
        '`Get-Process` shows: Id 4242 runaway, Id 1201 music, Id 1302 editor. You run `Stop-Process -Id 1302`. What stops?',
      ),
      options: same(['The editor', 'The runaway', 'All three']),
      answer: same(0),
      reasons: same(['Right: 1302 is the editor\'s ID.', 'That would be 4242.', 'Only the process with that ID stops.']),
      explain: same('Check the ID twice. Stopping the editor could lose unsaved work.'),
    }),
    match({
      id: 'u5-l1-c9',
      uses: ['ps', 'kill'],
      pairs: px(
        [
          ['ps aux', 'List running processes'],
          ['kill', 'Stop a process by its ID'],
          ['PID', 'A process\'s ID number'],
          ['%CPU', 'How much of the processor it uses'],
        ],
        [
          ['Get-Process', 'List running processes'],
          ['Stop-Process -Id', 'Stop a process by its ID'],
          ['Id', 'A process\'s ID number'],
          ['CPU(s)', 'Seconds of processor work so far'],
        ],
      ),
      explain: same('Look, then stop. Always in that order.'),
    }),
    task({
      id: 'u5-l1-c10',
      uses: ['ps', 'kill'],
      openHint: true,
      prompt: same('The computer is slow again. Find the process hogging the processor and stop it.'),
      seed: same(busy),
      goal: same(gone('runaway')),
      solutions: px([['ps aux', 'kill 4242'], ['kill 4242']], [['Get-Process', 'Stop-Process -Id 4242'], ['Stop-Process -Id 4242']]),
      hints: px(['List the processes, find the busy one\'s PID, stop it.', 'Type `ps aux`, then `kill 4242`.'], ['List the processes, find the busy one\'s Id, stop it.', 'Type `Get-Process`, then `Stop-Process -Id 4242`.']),
      explain: same('Runaway caught. Herme is impressed.'),
    }),
    task({
      id: 'u5-l1-c11',
      uses: ['chain'],
      review: true,
      prompt: same('Make a folder called evidence and step into it, in one line.'),
      seed: same(busy),
      goal: same({ kind: 'cwdIs', path: 'evidence' }),
      solutions: same([['mkdir evidence && cd evidence']]),
      hints: same(['Make it, then (if that worked) go in.', 'Type `mkdir evidence && cd evidence`.']),
      explain: same('In you go.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2: Run a script (script, allow-scripts)
// ---------------------------------------------------------------------------

export const unit5Lesson2: Lesson = {
  id: 'u5-l2',
  title: 'Run a script',
  challenges: [
    learn({
      id: 'u5-l2-c1',
      teaches: ['script'],
      seed: same(ready),
      card: px(
        {
          title: 'Run a script with ./',
          body: 'A **script** is a file full of commands, saved to run later. To run one from this folder, type `./` and its name. `./` means "right here".',
          example: './hello.sh',
        },
        {
          title: 'Run a script with .\\',
          body: 'A **script** is a file full of commands, saved to run later. PowerShell scripts end in `.ps1`. To run one from this folder, type `.\\` and its name. `.\\` means "right here".',
          example: '.\\hello.ps1',
        },
      ),
    }),
    typeAlong({
      id: 'u5-l2-c2',
      uses: ['script'],
      prompt: same('Run the hello script.'),
      seed: same(ready),
      goal: same({ kind: 'stdoutIncludes', text: 'Hello from a script' }),
      line: px('./hello.sh', '.\\hello.ps1'),
      explain: same('The script ran its commands for you, one by one.'),
    }),
    pick({
      id: 'u5-l2-c3',
      uses: ['script'],
      prompt: px('Why type `./hello.sh` and not `hello.sh` on its own?', 'Why type `.\\hello.ps1` and not `hello.ps1` on its own?'),
      options: same(['It says the file is right here, in this folder', 'It makes the script run faster', 'It marks a hidden file']),
      answer: same(0),
      reasons: px(
        [
          'Right. Without it, the terminal only looks in its list of installed commands, and says it cannot find it.',
          'Speed has nothing to do with it.',
          'A dot at the start of a name hides a file. Here the dot is a folder: this one.',
        ],
        [
          'Right. Without it, PowerShell only looks in its list of installed commands, and says it cannot find it.',
          'Speed has nothing to do with it.',
          'Here the dot is a folder: this one. (And Windows does not hide files with a dot.)',
        ],
      ),
      explain: same('This is a safety rule: a file in some folder cannot pretend to be a real command.'),
    }),
    task({
      id: 'u5-l2-c4',
      uses: ['script'],
      openHint: true,
      prompt: same('There is a build script in this folder. Run it.'),
      seed: same(ready),
      goal: built,
      solutions: px([['./build.sh']], [['.\\build.ps1']]),
      hints: px(['Right here, then the script\'s name.', 'Type `./build.sh`.'], ['Right here, then the script\'s name.', 'Type `.\\build.ps1`.']),
      explain: same('It made a dist folder and reported back.'),
    }),
    task({
      id: 'u5-l2-c5',
      uses: ['ps'],
      review: true,
      prompt: same('Check which processes are running.'),
      seed: same(ready),
      goal: same({ kind: 'stdoutIncludes', text: 'hermitd' }),
      solutions: px([['ps aux']], [['Get-Process']]),
      hints: px(['List every process.', 'Type `ps aux`.'], ['List every process.', 'Type `Get-Process`.']),
      explain: same('All calm. hermitd is the program that runs Hermit itself.'),
    }),
    learn({
      id: 'u5-l2-c6',
      teaches: ['allow-scripts'],
      seed: same(fresh),
      card: {
        linux: {
          title: 'chmod +x: allow a file to run',
          body: 'A file you just made or downloaded is not allowed to run: you get **Permission denied**. `chmod` (**ch**ange **mod**e) with `+x` adds e**x**ecute permission, so it can run.',
          example: 'chmod +x build.sh',
        },
        mac: {
          title: 'chmod +x: allow a file to run',
          body: 'A file you just made or downloaded is not allowed to run: you get **permission denied**. `chmod` (**ch**ange **mod**e) with `+x` adds e**x**ecute permission, so it can run.',
          example: 'chmod +x build.sh',
        },
        windows: {
          title: 'Allow your scripts to run',
          body: 'Some Windows computers block every script at first: **running scripts is disabled on this system**. This command lets scripts run **for you only** (`-Scope CurrentUser`). `RemoteSigned` means scripts you made can run, and ones from the internet need their maker\'s signature.',
          example: 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
        },
      },
    }),
    build({
      id: 'u5-l2-c7',
      uses: ['allow-scripts'],
      prompt: px('Build the command that lets `build.sh` run.', 'Build the command that lets your scripts run, for you only.'),
      seed: same(fresh),
      goal: same({ kind: 'canRun', path: 'build.sh' }),
      tokens: px(['build.sh', '-x', 'chmod', '+x', 'ls', 'rm'], ['RemoteSigned', 'CurrentUser', 'Set-ExecutionPolicy', 'Restricted', '-Scope', 'Get-ExecutionPolicy']),
      solutions: px([['chmod +x build.sh']], [['Set-ExecutionPolicy -Scope CurrentUser RemoteSigned']]),
      hints: px(['Change mode, add execute, then the file.'], ['Set the policy, for the current user, to RemoteSigned.']),
      explain: px(
        'Now build.sh may run. `ls -l` would show it as `-rwxr-xr-x`: each `x` means "may run".',
        'Now your own scripts may run. You only need to do this once.',
      ),
    }),
    pick({
      id: 'u5-l2-c8',
      uses: ['allow-scripts', 'script'],
      prompt: px('You just downloaded `build.sh` and type `./build.sh`. What happens?', 'Scripts have never been allowed on this computer. You type `.\\build.ps1`. What happens?'),
      options: {
        linux: ['bash: ./build.sh: Permission denied', 'Build complete', 'bash: build.sh: command not found'],
        mac: ['zsh: permission denied: ./build.sh', 'Build complete', 'zsh: command not found: build.sh'],
        windows: ['An error: running scripts is disabled on this system', 'Build complete', 'Windows opens the file in Notepad'],
      },
      answer: same(0),
      reasons: px(
        ['Right: new files are not allowed to run until you `chmod +x` them.', 'Not yet. It needs permission first.', 'The `./` points right at the file, so the terminal finds it. It is just not allowed to run it.'],
        ['Right: scripts are blocked until you change the execution policy.', 'Not yet. Scripts are blocked first.', 'Double-clicking it might, but in the terminal you get an error.'],
      ),
      explain: px('Permission denied means "found it, not allowed". `chmod +x` fixes it.', '`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` fixes it, once.'),
    }),
    match({
      id: 'u5-l2-c9',
      uses: ['script', 'allow-scripts', 'ps'],
      pairs: {
        linux: [
          ['./build.sh', 'Run a script from here'],
          ['chmod +x', 'Allow a file to run'],
          ['Permission denied', 'Found it, not allowed to run it'],
          ['ps aux', 'List running processes'],
        ],
        mac: [
          ['./build.sh', 'Run a script from here'],
          ['chmod +x', 'Allow a file to run'],
          ['permission denied', 'Found it, not allowed to run it'],
          ['ps aux', 'List running processes'],
        ],
        windows: [
          ['.\\build.ps1', 'Run a script from here'],
          ['Set-ExecutionPolicy', 'Allow scripts to run'],
          ['running scripts is disabled', 'Scripts are blocked'],
          ['Get-Process', 'List running processes'],
        ],
      },
      explain: same('Found it, allowed it, ran it.'),
    }),
    task({
      id: 'u5-l2-c10',
      uses: ['script', 'allow-scripts'],
      openHint: true,
      prompt: px(
        'Herme downloaded a build script onto a brand new computer. Get it to run.',
        'Herme wrote a build script, but this computer does not let scripts run yet. Get it to run.',
      ),
      seed: same(fresh),
      goal: built,
      solutions: px(
        [['chmod +x build.sh', './build.sh'], ['bash build.sh']],
        [['Set-ExecutionPolicy -Scope CurrentUser RemoteSigned', '.\\build.ps1']],
      ),
      hints: px(['Allow it first, then run it.', 'Type `chmod +x build.sh`, then `./build.sh`.'], ['Allow scripts first, then run it.', 'Type `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then `.\\build.ps1`.']),
      explain: same('Build complete. You only need to allow it once.'),
    }),
    task({
      id: 'u5-l2-c11',
      uses: ['kill'],
      review: true,
      prompt: same('The music player (ID 1201) is stuck. Stop it.'),
      seed: same(busy),
      goal: same(gone('music')),
      solutions: px([['kill 1201']], [['Stop-Process -Id 1201']]),
      hints: px(['Stop it by its ID.', 'Type `kill 1201`.'], ['Stop it by its Id.', 'Type `Stop-Process -Id 1201`.']),
      explain: same('Silence. Lovely.'),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3: Admin powers (admin, pkill)
// ---------------------------------------------------------------------------

const SUDO_BODY = (error: string): string =>
  `Some processes belong to **root**, the administrator account that runs the system. Stopping one says **${error}**. Put \`sudo\` in front to run one command as root. On a real computer it asks for your password first.`;

const adminCard: PerOs<{ title: string; body: string; example: string }> = {
  linux: { title: 'sudo: run as the administrator', body: SUDO_BODY('Operation not permitted'), example: 'sudo kill 666' },
  mac: { title: 'sudo: run as the administrator', body: SUDO_BODY('operation not permitted'), example: 'sudo kill 666' },
  windows: {
    title: 'Open an Administrator window',
    body: 'Processes that belong to the system say **Access is denied**. You need a PowerShell window running as **Administrator**. This opens one: `pwsh` is PowerShell\'s program name, and `-Verb RunAs` means "as Administrator". Windows asks "Do you want to allow this app to make changes?" first.',
    example: 'Start-Process pwsh -Verb RunAs',
  },
};

export const unit5Lesson3: Lesson = {
  id: 'u5-l3',
  title: 'Admin powers',
  challenges: [
    learn({ id: 'u5-l3-c1', teaches: ['admin'], uses: ['kill'], seed: same(crowded), card: adminCard }),
    typeAlong({
      id: 'u5-l3-c2',
      uses: ['admin'],
      prompt: px('The system updater (PID 666) is stuck, and it belongs to root. Stop it as the administrator.', 'The system updater (Id 666) is stuck, and it belongs to the system. Open an Administrator window.'),
      seed: same(crowded),
      goal: px(gone('updater'), { kind: 'isAdmin' }),
      line: px('sudo kill 666', 'Start-Process pwsh -Verb RunAs'),
      explain: px(
        'Gone. sudo works for one command, then you are back to normal. On a real computer, the password you type stays invisible. That is normal: keep typing and press Enter.',
        'You are now in the Administrator window. It stays that way until you close it, so close it when you are done.',
      ),
    }),
    pick({
      id: 'u5-l3-c3',
      uses: ['admin', 'kill'],
      prompt: {
        linux: '`kill 666` says "Operation not permitted". What now?',
        mac: '`kill 666` says "operation not permitted". What now?',
        windows: '`Stop-Process -Id 666` says "Access is denied". What now?',
      },
      options: px(
        ['sudo kill 666', 'kill -9 666', 'rm 666'],
        ['Open an Administrator window, then try again', 'Stop-Process -Id 666 -Force', 'Remove-Item 666'],
      ),
      answer: same(0),
      reasons: px(
        ['Right: the problem is who you are, not how hard you ask.', '`-9` makes kill more forceful, but you are still not allowed.', 'rm deletes files. 666 is a process, not a file.'],
        ['Right: the problem is who you are, not how hard you ask.', '`-Force` skips the "are you sure?" question, but you are still not allowed.', 'Remove-Item deletes files. 666 is a process, not a file.'],
      ),
      explain: px('"Not permitted" means: this needs root. That is what `sudo` is for.', '"Access is denied" means: this needs an Administrator window.'),
    }),
    task({
      id: 'u5-l3-c4',
      uses: ['admin', 'kill'],
      openHint: true,
      prompt: same('The stuck updater (ID 666) is hogging the processor. Stop it.'),
      seed: same(crowded),
      goal: same(gone('updater')),
      solutions: px([['sudo kill 666']], [['Start-Process pwsh -Verb RunAs', 'Stop-Process -Id 666']]),
      hints: px(['It belongs to root, so you need sudo.', 'Type `sudo kill 666`.'], ['It belongs to the system, so you need an Administrator window first.', 'Type `Start-Process pwsh -Verb RunAs`, then `Stop-Process -Id 666`.']),
      explain: px(
        'The updater is gone, and the computer can breathe. sudo can change anything, so use it only when you know why a command needs it.',
        'The updater is gone, and the computer can breathe. An Administrator window can change anything, so use it only when you need it.',
      ),
    }),
    task({
      id: 'u5-l3-c5',
      uses: ['script', 'allow-scripts'],
      review: true,
      prompt: same('Run the new build script. It is not allowed to run yet.'),
      seed: same(fresh),
      goal: built,
      solutions: px([['chmod +x build.sh', './build.sh']], [['Set-ExecutionPolicy -Scope CurrentUser RemoteSigned', '.\\build.ps1']]),
      hints: px(['Allow it, then run it.', 'Type `chmod +x build.sh`, then `./build.sh`.'], ['Allow scripts, then run it.', 'Type `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then `.\\build.ps1`.']),
      explain: same('Built.'),
    }),
    learn({
      id: 'u5-l3-c6',
      teaches: ['pkill'],
      uses: ['kill'],
      seed: same(crowded),
      card: px(
        {
          title: 'pkill: stop by name',
          body: '`pkill` stops processes **by name** instead of ID. It stops **every** process with that name, so check the name first. Handy when there are lots.',
          example: 'pkill music',
        },
        {
          title: 'Stop-Process -Name: stop by name',
          body: '`-Name` stops processes **by name** instead of ID. It stops **every** process with that name, so check the name first. Handy when there are lots.',
          example: 'Stop-Process -Name music',
        },
      ),
    }),
    fill({
      id: 'u5-l3-c7',
      uses: ['pkill'],
      prompt: same('Three bubbles processes are floating around. Stop all of them at once.'),
      seed: same(crowded),
      goal: same(gone('bubbles')),
      template: px('___ bubbles', 'Stop-Process ___ bubbles'),
      options: px(['kill', 'pkill', 'ps', 'rm'], ['-Id', '-Name', '-Force', '-Path']),
      answer: same(1),
      hints: same(['You have a name, not an ID.']),
      explain: same('Pop, pop, pop.'),
    }),
    pick({
      id: 'u5-l3-c8',
      uses: ['pkill', 'kill'],
      prompt: px('How does `pkill` pick which processes to stop?', 'How does `Stop-Process -Name` pick which processes to stop?'),
      options: same(['By name: every process called that', 'By ID: one exact process', 'By how hard they are working']),
      answer: same(0),
      reasons: px(
        ['Right. A name can match several processes, so be careful.', 'That is `kill`, with a PID.', 'Neither command looks at that. You check it with `ps aux` first.'],
        ['Right. A name can match several processes, so be careful.', 'That is `Stop-Process -Id`.', 'Neither one looks at that. You check it with `Get-Process` first.'],
      ),
      explain: same('ID for one exact process, name for all of them.'),
    }),
    match({
      id: 'u5-l3-c9',
      uses: ['admin', 'pkill', 'kill', 'ps'],
      pairs: px(
        [
          ['sudo', 'Run one command as the administrator'],
          ['pkill', 'Stop every process with a name'],
          ['kill', 'Stop one process by ID'],
          ['ps aux', 'List running processes'],
        ],
        [
          ['Start-Process pwsh -Verb RunAs', 'Open an Administrator window'],
          ['Stop-Process -Name', 'Stop every process with a name'],
          ['Stop-Process -Id', 'Stop one process by ID'],
          ['Get-Process', 'List running processes'],
        ],
      ),
      explain: same('Look first, then stop the right thing, with just enough power.'),
    }),
    task({
      id: 'u5-l3-c10',
      uses: ['admin', 'pkill', 'kill'],
      openHint: true,
      prompt: same('Clean-up time: stop all the bubbles processes and the stuck updater (ID 666).'),
      seed: same(crowded),
      goal: all(gone('bubbles'), gone('updater')),
      solutions: px(
        [['pkill bubbles', 'sudo kill 666'], ['sudo pkill bubbles', 'sudo kill 666']],
        [['Start-Process pwsh -Verb RunAs', 'Stop-Process -Name bubbles', 'Stop-Process -Id 666'], ['Stop-Process -Name bubbles', 'Start-Process pwsh -Verb RunAs', 'Stop-Process -Id 666']],
      ),
      hints: px(['Bubbles by name, the updater as administrator.', 'Type `pkill bubbles`, then `sudo kill 666`.'], ['Bubbles by name, the updater from an Administrator window.', 'Type `Stop-Process -Name bubbles`, then `Start-Process pwsh -Verb RunAs`, then `Stop-Process -Id 666`.']),
      explain: same('Spotless. Herme retires to a nice rock.'),
    }),
    task({
      id: 'u5-l3-c11',
      uses: ['ps', 'redirect'],
      review: true,
      prompt: same('Save the list of running processes into procs.txt.'),
      seed: same(crowded),
      goal: same({ kind: 'fileContains', path: 'procs.txt', text: 'bubbles' }),
      solutions: px([['ps aux > procs.txt']], [['Get-Process > procs.txt']]),
      hints: px(['List, then one arrow into the file.', 'Type `ps aux > procs.txt`.'], ['List, then one arrow into the file.', 'Type `Get-Process > procs.txt`.']),
      explain: same('Saved for the history books. That is Unit 5 done: you can take charge of a misbehaving computer.'),
    }),
  ],
};

export const unit5: Unit = {
  id: 'u5',
  title: 'Processes and permissions',
  blurb: 'Stop runaway programs, run scripts, and use administrator powers.',
  lessons: [unit5Lesson1, unit5Lesson2, unit5Lesson3],
};
