import { describe, expect, it } from 'vitest';
import { buildMachine } from '../../machine';
import type { MachineState } from '../../types';
import { exists } from '../../vfs/vfs';
import { caseInsensitive } from '../../vfs/vfs';
import { powershell } from './index';

const seed = {
  files: { 'notes.txt': 'one\ntwo\nthree\n', 'junk/a.txt': 'x', 'projects/game/main.py': 'print(1)' },
  dirs: ['empty'],
  hidden: ['secret.txt'],
  executable: [],
  cwd: '',
  env: {},
  processes: [],
};
const fresh = (): MachineState => buildMachine('windows', { ...seed, files: { ...seed.files, 'secret.txt': 'shh' } });
const run = (line: string, state = fresh()) => powershell.run(line, state);
const at = (state: MachineState, rel: string) => exists(state.root, ['C:', 'Users', 'you', ...rel.split('/')], caseInsensitive);

describe('PowerShell dialect', () => {
  it('shows the PS prompt', () => {
    expect(powershell.prompt(fresh())).toBe('PS C:\\Users\\you> ');
  });

  it('Get-Location prints a Path table', () => {
    expect(run('Get-Location').stdout).toBe('\nPath\n----\nC:\\Users\\you\n\n');
    expect(run('pwd').stdout).toContain('C:\\Users\\you');
  });

  it('is case-insensitive for cmdlets, parameters and paths', () => {
    const r = run('SET-location PROJECTS');
    expect(r.exitCode).toBe(0);
    expect(r.state.cwd).toEqual(['C:', 'Users', 'you', 'projects']);
  });

  it('Set-Location to a missing folder errors like PS 7', () => {
    const r = run('cd nope');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toBe("Set-Location: Cannot find path 'C:\\Users\\you\\nope' because it does not exist.\n");
  });

  it('Get-ChildItem lists folders first and hides hidden files without -Force', () => {
    const r = run('Get-ChildItem');
    expect(r.stdout).toContain('    Directory: C:\\Users\\you');
    expect(r.stdout.indexOf('empty')).toBeLessThan(r.stdout.indexOf('notes.txt'));
    expect(r.stdout).not.toContain('secret.txt');
    expect(run('ls -Force').stdout).toContain('secret.txt');
    expect(run('dir -fOrCe').stdout).toContain('secret.txt');
    // PS 7 added -FollowSymlink, so -fo is ambiguous there too.
    expect(run('dir -fo').stderr).toContain("'fo' is ambiguous");
  });

  it('member enumeration returns names', () => {
    expect(run('(Get-ChildItem projects).Name').stdout).toBe('game\n');
  });

  it('rm -rf fails with the real parameter error (acceptance)', () => {
    const r = run('rm -rf junk');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toBe("Remove-Item: A parameter cannot be found that matches parameter name 'rf'.\n");
    expect(at(r.state, 'junk')).toBe(true);
  });

  it('Remove-Item -Recurse -Force removes a folder, -r works by prefix', () => {
    expect(at(run('Remove-Item junk -Recurse -Force').state, 'junk')).toBe(false);
    expect(at(run('rm -r junk').state, 'junk')).toBe(false);
  });

  it('Remove-Item on a non-empty folder without -Recurse refuses', () => {
    const r = run('Remove-Item junk');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('has children and the Recurse parameter was not specified');
  });

  it('New-Item makes files and folders; mkdir is a function', () => {
    expect(at(run('New-Item todo.txt').state, 'todo.txt')).toBe(true);
    expect(at(run('mkdir a/b').state, 'a/b')).toBe(true);
    expect(run('New-Item notes.txt').stderr).toBe("New-Item: The file 'C:\\Users\\you\\notes.txt' already exists.\n");
  });

  it('Get-Content reads lines, with -Head and -Tail', () => {
    expect(run('cat notes.txt').stdout).toBe('one\ntwo\nthree\n');
    expect(run('Get-Content notes.txt -Head 1').stdout).toBe('one\n');
    expect(run('gc notes.txt -Tail 1').stdout).toBe('three\n');
    expect(run('cat junk').stderr).toContain('Unable to get content because it is a directory');
  });

  it('Copy-Item copies a folder only with -Recurse', () => {
    const shallow = run('Copy-Item projects backup');
    expect(at(shallow.state, 'backup')).toBe(true);
    expect(at(shallow.state, 'backup/game')).toBe(false);
    expect(at(run('Copy-Item projects backup -Recurse').state, 'backup/game/main.py')).toBe(true);
  });

  it('Move-Item and Rename-Item', () => {
    expect(at(run('Move-Item notes.txt projects').state, 'projects/notes.txt')).toBe(true);
    const r = run('Rename-Item notes.txt diary.txt');
    expect(at(r.state, 'diary.txt')).toBe(true);
    expect(at(r.state, 'notes.txt')).toBe(false);
  });

  it('redirects output to a file', () => {
    const r = run('echo hi > out.txt; Get-Content out.txt');
    expect(r.stdout).toBe('hi\n');
  });

  it('unknown commands are not recognized', () => {
    const r = run('frobnicate');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("frobnicate: The term 'frobnicate' is not recognized");
  });

  it('&& and || follow success', () => {
    expect(run('cd nope && echo yes').stdout).toBe('');
    expect(run('cd nope || echo fallback').stdout).toBe('fallback\n');
  });

  it('expands variables and sets env vars', () => {
    expect(run('echo "home is $HOME"').stdout).toBe('home is C:\\Users\\you\n');
    const r = run('$env:GREETING = "hello"');
    expect(run('$env:GREETING', r.state).stdout).toBe('hello\n');
  });

  it('complex script blocks get a friendly message', () => {
    expect(run('ls | ForEach-Object { $_.Name.ToUpper() }').stderr).toContain('Hermit only understands');
    expect(run('$x = 1').stderr).toContain("Hermit doesn't simulate");
  });
});
