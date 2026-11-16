import { describe, expect, it } from 'vitest';
import { buildMachine, type SeedState } from '../../machine';
import type { MachineState } from '../../types';
import { caseInsensitive, exists } from '../../vfs/vfs';
import { powershell } from './index';

const seed: SeedState = {
  files: {
    'app.js': 'const a = 1;\n// TODO: tidy\nconsole.log(a);\n',
    'src/util.js': '// TODO: test\nexport const x = 2;\n',
    'logs/today.log': 'one\ntwo\nthree\nfour\nfive\n',
    'logs/old.log': 'old\n',
    'names.txt': 'sam\nalex\nsam\nkim\nalex\n',
    'big.bin': 'x'.repeat(500),
    'build.ps1': '# build\nmkdir dist\nWrite-Output "Build complete"\n',
  },
  processes: [{ pid: 4242, name: 'runaway', cpu: 99.2 }, { pid: 1201, name: 'music', cpu: 1.5 }],
};
const fresh = (): MachineState => buildMachine('windows', seed);
const run = (line: string, state = fresh()) => powershell.run(line, state);

describe('Select-String', () => {
  it('searches a file, showing the relative path and line number', () => {
    expect(run('Select-String "TODO" app.js').stdout).toBe('app.js:2:// TODO: tidy\n');
  });
  it('searches a whole folder through the pipeline', () => {
    expect(run('Get-ChildItem -Recurse | Select-String "TODO"').stdout).toBe('app.js:2:// TODO: tidy\nsrc\\util.js:1:// TODO: test\n');
  });
  it('filters piped text', () => {
    expect(run('Get-Content names.txt | Select-String kim').stdout).toBe('kim\n');
  });
  it('missing files error', () => {
    expect(run('Select-String TODO nope.js').stderr).toContain("Cannot find path 'C:\\Users\\you\\nope.js' because it does not exist.");
  });
});

describe('finding and counting', () => {
  it('finds files by name', () => {
    expect(run('(Get-ChildItem -Recurse -Filter *.log).Name').stdout).toBe('old.log\ntoday.log\n');
  });
  it('first and last lines', () => {
    expect(run('Get-Content logs\\today.log -TotalCount 2').stdout).toBe('one\ntwo\n');
    expect(run('Get-Content logs\\today.log -Tail 1').stdout).toBe('five\n');
  });
  it('counts lines', () => {
    const out = run('Get-Content names.txt | Measure-Object -Line').stdout;
    expect(out).toContain('Lines Words Characters Property');
    expect(out).toContain('    5');
    expect(run('(Get-Content names.txt | Measure-Object -Line).Lines').stdout).toBe('5\n');
    expect(run('Get-ChildItem | Measure-Object').stdout).toContain('Count             : 6');
  });
});

describe('pipelines of objects', () => {
  it('Where-Object, simplified and script-block forms', () => {
    expect(run('(Get-ChildItem | Where-Object Name -like "*.txt").Name').stdout).toBe('names.txt\n');
    expect(run('(Get-ChildItem | Where-Object { $_.Length -gt 100 }).Name').stdout).toBe('big.bin\n');
    expect(run('Get-ChildItem | Where-Object { $_.Name.Length -gt 1 }').stderr).toContain('simple filters');
  });
  it('Sort-Object -Unique', () => {
    expect(run('Get-Content names.txt | Sort-Object -Unique').stdout).toBe('alex\nkim\nsam\n');
    expect(run('Get-Content names.txt | sort').stdout).toBe('alex\nalex\nkim\nsam\nsam\n');
  });
  it('three biggest files', () => {
    const r = run('Get-ChildItem -File | Sort-Object Length -Descending | Select-Object -First 3');
    const names = r.stdout.split('\n').filter((l) => /^-a/.test(l)).map((l) => l.split(' ').pop());
    expect(names).toEqual(['big.bin', 'build.ps1', 'app.js']);
  });
  it('Select-Object properties render a table', () => {
    expect(run('Get-ChildItem -File | Select-Object -First 1 Name, Length').stdout).toBe('\nName   Length\n----   ------\napp.js     43\n\n');
  });
  it('redirects and appends', () => {
    expect(run('"done" >> log.txt; "again" >> log.txt; Get-Content log.txt').stdout).toBe('done\nagain\n');
    expect(run('Get-ChildItem > files.txt; Get-Content files.txt').stdout).toContain('names.txt');
  });
});

describe('processes', () => {
  it('lists and finds programs', () => {
    expect(run('Get-Process').stdout).toContain('runaway');
    expect(run('Get-Process -Name runaway').stdout).toContain('99.20');
    expect(run('Get-Process nope').stderr).toBe('Get-Process: Cannot find a process with the name "nope". Verify the process name and call the cmdlet again.\n');
  });
  it('stops programs by name, id or pipeline', () => {
    const gone = (line: string) => !run(line).state.processes.some((p) => p.name === 'runaway');
    expect(gone('Stop-Process -Name runaway')).toBe(true);
    expect(gone('Stop-Process -Id 4242')).toBe(true);
    expect(gone('Get-Process runaway | Stop-Process')).toBe(true);
    expect(gone('kill 4242')).toBe(true);
    expect(run('Stop-Process -Id 999').stderr).toBe('Stop-Process: Cannot find a process with the process identifier 999.\n');
  });
});

describe('scripts and execution policy', () => {
  it('scripts are blocked until the policy allows them', () => {
    const r = run('.\\build.ps1');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('cannot be loaded because running scripts is disabled on this system');
  });
  it('needs .\\ even then', () => {
    expect(run('build.ps1').stderr).toContain('does exist in the current location');
  });
  it('the machine-wide policy needs admin; CurrentUser does not', () => {
    expect(run('Set-ExecutionPolicy RemoteSigned').stderr).toContain('Run as administrator');
    const r = run('Set-ExecutionPolicy -Scope CurrentUser RemoteSigned; .\\build.ps1');
    expect(r.stdout).toContain('Build complete');
    expect(exists(r.state.root, ['C:', 'Users', 'you', 'dist'], caseInsensitive)).toBe(true);
  });
  it('Start-Process -Verb RunAs opens an admin window', () => {
    expect(run('Start-Process pwsh -Verb RunAs').state.isAdmin).toBe(true);
  });
});

describe('Group-Object and Get-Unique', () => {
  it('groups equal lines and counts them, in first-seen order', () => {
    expect(run('Get-Content names.txt | Group-Object').stdout).toBe(
      '\nCount Name Group\n----- ---- -----\n    2 sam  {sam, sam}\n    2 alex {alex, alex}\n    1 kim  {kim}\n\n',
    );
  });
  it('sorts groups by count', () => {
    expect(run('Get-Content names.txt | Group-Object -NoElement | Sort-Object Count | Select-Object -First 1 -ExpandProperty Name').stdout).toBe('kim\n');
  });
  it('Get-Unique drops adjacent repeats only', () => {
    expect(run('Get-Content names.txt | Get-Unique').stdout).toBe('sam\nalex\nsam\nkim\nalex\n');
    expect(run('Get-Content names.txt | Sort-Object | Get-Unique').stdout).toBe('alex\nkim\nsam\n');
  });
});
