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
      card: px(
        {
          title: 'ps aux: see what is running',
          body: 'Every running program is a **process**. `ps aux` lists them all. **PID** is each one\'s ID number, and **%CPU** is how hard it is working.',
          example: 'ps aux',
        },
        {
          title: 'Get-Process: see what is running',
          body: 'Every running program is a **process**. `Get-Process` lists them all. **Id** is each one\'s ID number, and **CPU(s)** is how much work it has done.',
          example: 'Get-Process',
        },
      ),
    }),
    typeAlong({
      id: 'u5-l1-c2',
      uses: ['ps'],
      prompt: same('Herme\'s computer is crawling. List the running processes.'),
      seed: same(busy),
      goal: same({ kind: 'stdoutIncludes', text: 'runaway' }),
      line: px('ps aux', 'Get-Process'),
      explain: same('Look at runaway: 99% of the processor, all by itself.'),
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
      prompt: same('Which process is using the most CPU? List the processes and look.'),
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
          body: '`kill` and a PID asks that process to stop. Nothing prints when it works. Here, 1201 is the music player.',
          example: 'kill 1201',
        },
        {
          title: 'Stop-Process: stop a process',
          body: '`Stop-Process -Id` and an Id stops that process. Nothing prints when it works. Here, 1201 is the music player.',
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
        'ps aux shows: PID 4242 runaway, PID 1201 music, PID 1302 editor. You run kill 1302. What stops?',
        'Get-Process shows: Id 4242 runaway, Id 1201 music, Id 1302 editor. You run Stop-Process -Id 1302. What stops?',
      ),
      options: same(['The editor', 'The runaway', 'Everything']),
      answer: same(0),
      reasons: same(['Right: 1302 is the editor\'s ID.', 'That would be 4242.', 'Only the process with that ID stops.']),
      explain: same('Check the ID twice. Stopping the editor loses unsaved work.'),
    }),
    match({
      id: 'u5-l1-c9',
      uses: ['ps', 'kill'],
      pairs: px(
        [
          ['ps aux', 'List running processes'],
          ['kill', 'Stop a process by its ID'],
          ['PID', 'A process\'s ID number'],
          ['%CPU', 'How hard it is working'],
        ],
        [
          ['Get-Process', 'List running processes'],
          ['Stop-Process -Id', 'Stop a process by its ID'],
          ['Id', 'A process\'s ID number'],
          ['CPU(s)', 'How much work it has done'],
        ],
      ),
      explain: same('Look, then stop. Always in that order.'),
    }),
    task({
      id: 'u5-l1-c10',
      uses: ['ps', 'kill'],
      prompt: same('The computer is slow again. Find the process hogging the CPU and stop it.'),
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
      prompt: px('Why type ./hello.sh and not just hello.sh?', 'Why type .\\hello.ps1 and not just hello.ps1?'),
      options: px(
        ['./ says the file is right here, in this folder', './ makes the script run faster', 'The dot marks a hidden file'],
        ['.\\ says the file is right here, in this folder', '.\\ makes the script run faster', 'The dot marks a hidden file'],
      ),
      answer: same(0),
      reasons: same([
        'Right. Without it, the shell only looks in its list of installed commands, and says it cannot find it.',
        'Speed has nothing to do with it.',
        'A dot at the start of a name hides a file. Here the dot is a folder: this one.',
      ]),
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
      card: px(
        {
          title: 'chmod +x: allow a file to run',
          body: 'A file you just made or downloaded is not allowed to run: you get **Permission denied**. `chmod +x` adds e**x**ecute permission, so it can.',
          example: 'chmod +x build.sh',
        },
        {
          title: 'Allow your scripts to run',
          body: 'A fresh Windows computer blocks every script. This lets scripts run **for you only** (`-Scope CurrentUser`). `RemoteSigned` means your own scripts run, and downloaded ones need a signature.',
          example: 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
        },
      ),
    }),
    build({
      id: 'u5-l2-c7',
      uses: ['allow-scripts'],
      prompt: px('Build the command that lets build.sh run.', 'Build the command that lets your scripts run, without needing an Administrator.'),
      seed: same(fresh),
      goal: same({ kind: 'canRun', path: 'build.sh' }),
      tokens: px(['build.sh', '-x', 'chmod', '+x', 'sudo', 'rm'], ['RemoteSigned', 'CurrentUser', 'Set-ExecutionPolicy', 'Restricted', '-Scope', 'Get-ExecutionPolicy']),
      solutions: px([['chmod +x build.sh']], [['Set-ExecutionPolicy -Scope CurrentUser RemoteSigned']]),
      hints: px(['Change mode, add execute, then the file.'], ['Set the policy, for the current user, to RemoteSigned.']),
      explain: same('Now the script is allowed to run.'),
    }),
    pick({
      id: 'u5-l2-c8',
      uses: ['allow-scripts', 'script'],
      prompt: px('You just downloaded build.sh and type ./build.sh. What happens?', 'On a fresh Windows computer, you type .\\build.ps1. What happens?'),
      options: {
        linux: ['bash: ./build.sh: Permission denied', 'Build complete', 'bash: build.sh: command not found'],
        mac: ['zsh: permission denied: ./build.sh', 'Build complete', 'zsh: command not found: build.sh'],
        windows: ['An error: running scripts is disabled on this system', 'Build complete', 'Windows opens the file in Notepad'],
      },
      answer: same(0),
      reasons: px(
        ['Right: new files are not allowed to run until you chmod +x them.', 'Not yet. It needs permission first.', 'The ./ means the shell found it. It just may not run it.'],
        ['Right: scripts are blocked until you change the execution policy.', 'Not yet. Scripts are blocked first.', 'Double-clicking might, but in the terminal you get an error.'],
      ),
      explain: px('Permission denied means "found it, not allowed". chmod +x fixes it.', 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned fixes it, once.'),
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
      prompt: same('Herme downloaded a build script onto a brand new computer. Get it to run.'),
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

const adminCard = px(
  {
    title: 'sudo: run as the administrator',
    body: 'Some processes belong to the system (user **root**), and you get **Operation not permitted**. Put `sudo` in front to run one command as the administrator. On a real computer it asks for your password first.',
    example: 'sudo kill 666',
  },
  {
    title: 'Open an Administrator window',
    body: 'System processes say **Access is denied**. You need a PowerShell window running as **Administrator**: this opens one, after Windows asks "Do you want to allow this app to make changes?"',
    example: 'Start-Process pwsh -Verb RunAs',
  },
);

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
      explain: px('Gone. sudo works for one command, then you are back to normal.', 'You are now in the Administrator window. It stays that way until you close it.'),
    }),
    pick({
      id: 'u5-l3-c3',
      uses: ['admin', 'kill'],
      prompt: px('kill 666 says "Operation not permitted". What now?', 'Stop-Process -Id 666 says "Access is denied". What now?'),
      options: px(
        ['sudo kill 666', 'kill -9 666, to push harder', 'rm 666'],
        ['Open an Administrator window, then try again', 'Stop-Process -Id 666 -Force', 'Remove-Item 666'],
      ),
      answer: same(0),
      reasons: px(
        ['Right: the problem is who you are, not how hard you ask.', 'A stronger signal does not help: you are still not allowed.', 'rm deletes files. 666 is a process, not a file.'],
        ['Right: the problem is who you are, not how hard you ask.', '-Force skips the "are you sure?" question, but you are still not allowed.', 'Remove-Item deletes files. 666 is a process, not a file.'],
      ),
      explain: same('"Not permitted" and "denied" mean: you need to be the administrator.'),
    }),
    task({
      id: 'u5-l3-c4',
      uses: ['admin', 'kill'],
      openHint: true,
      prompt: same('The stuck updater (ID 666) is eating the CPU. Stop it.'),
      seed: same(crowded),
      goal: same(gone('updater')),
      solutions: px([['sudo kill 666']], [['Start-Process pwsh -Verb RunAs', 'Stop-Process -Id 666']]),
      hints: px(['It belongs to root, so you need sudo.', 'Type `sudo kill 666`.'], ['It belongs to the system, so you need an Administrator window first.', 'Type `Start-Process pwsh -Verb RunAs`, then `Stop-Process -Id 666`.']),
      explain: same('The updater is gone, and the computer can breathe.'),
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
          body: '`pkill` stops processes **by name** instead of ID, and it stops **every** process with that name. Handy when there are lots.',
          example: 'pkill music',
        },
        {
          title: 'Stop-Process -Name: stop by name',
          body: '`-Name` stops processes **by name** instead of ID, and it stops **every** process with that name. Handy when there are lots.',
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
      prompt: px('What is the difference between kill and pkill?', 'What is the difference between Stop-Process -Id and -Name?'),
      options: px(
        ['kill takes an ID number, pkill takes a name', 'pkill is stronger than kill', 'pkill only works with sudo'],
        ['-Id takes a number, -Name takes a name', '-Name is stronger than -Id', '-Name only works as Administrator'],
      ),
      answer: same(0),
      reasons: same(['Right. A name can match several processes, so be careful.', 'Both ask the process to stop in the same way.', 'Only processes that belong to the system need the administrator.']),
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
      explain: same('That is Unit 5. You can now take charge of a misbehaving computer.'),
    }),
    task({
      id: 'u5-l3-c10',
      uses: ['admin', 'pkill', 'kill'],
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
      explain: same('Saved for the history books.'),
    }),
  ],
};

export const unit5: Unit = {
  id: 'u5',
  title: 'Processes and permissions',
  blurb: 'Stop runaway programs, run scripts, and use administrator powers.',
  lessons: [unit5Lesson1, unit5Lesson2, unit5Lesson3],
};
