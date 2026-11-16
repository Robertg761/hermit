import { describe, expect, it } from 'vitest';
import { buildMachine } from '../../machine';
import type { MachineState } from '../../types';
import { exists, readFile } from '../../vfs/vfs';
import { bash } from './index';

const seed = buildMachine('linux', {
  files: {
    'notes.txt': 'hello\n',
    '.bashrc': '# config\n',
    'projects/app/main.js': 'console.log(1)\n',
    'projects/readme.md': '# readme\n',
    'b.txt': 'b\n',
  },
  dirs: ['empty'],
});

/** Run several lines, returning the final result. */
const run = (lines: readonly string[], state: MachineState = seed) => {
  let s = state;
  let last = bash.run('', s);
  for (const l of lines) {
    last = bash.run(l, s);
    s = last.state;
  }
  return last;
};
const H = '/home/you';
const at = (_state: MachineState, rel: string) => ['home', 'you', ...rel.split('/')];
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
const strip = (s: string) => s.replace(ANSI, '');

describe('prompt', () => {
  it('shows ~ at home and the subfolder elsewhere', () => {
    expect(bash.prompt(seed)).toBe('you@hermit:~$ ');
    expect(bash.prompt(run(['cd projects']).state)).toBe('you@hermit:~/projects$ ');
    expect(bash.prompt(run(['cd /tmp']).state)).toBe('you@hermit:/tmp$ ');
  });
});

describe('pwd and cd', () => {
  it('prints the home folder', () => {
    expect(run(['pwd']).stdout).toBe(`${H}\n`);
  });
  it('changes into folders and back', () => {
    expect(run(['cd projects', 'pwd']).stdout).toBe(`${H}/projects\n`);
    expect(run(['cd projects/app', 'cd ..', 'pwd']).stdout).toBe(`${H}/projects\n`);
    expect(run(['cd projects', 'cd ~', 'pwd']).stdout).toBe(`${H}\n`);
    expect(run(['cd projects', 'cd', 'pwd']).stdout).toBe(`${H}\n`);
    expect(run(['cd /', 'cd ~/projects', 'pwd']).stdout).toBe(`${H}/projects\n`);
  });
  it('cd - returns to the previous folder', () => {
    expect(run(['cd projects', 'cd /tmp', 'cd -']).stdout).toBe(`${H}/projects\n`);
  });
  it('errors on missing folders and files', () => {
    const r = run(['cd nope']);
    expect(r.stderr).toBe('bash: cd: nope: No such file or directory');
    expect(r.exitCode).toBe(1);
    expect(run(['cd notes.txt']).stderr).toBe('bash: cd: notes.txt: Not a directory');
  });
});

describe('ls', () => {
  it('lists visible files in columns', () => {
    expect(strip(run(['ls']).stdout)).toBe('b.txt  empty  notes.txt  projects\n');
  });
  it('colours folders blue', () => {
    expect(run(['ls']).stdout).toContain('\x1b[1;34mprojects\x1b[0m');
  });
  it('-a shows dotfiles and . ..', () => {
    expect(strip(run(['ls -a']).stdout)).toBe('.  ..  .bashrc  b.txt  empty  notes.txt  projects\n');
  });
  it('-A shows dotfiles without . and ..', () => {
    expect(strip(run(['ls -A']).stdout)).toBe('.bashrc  b.txt  empty  notes.txt  projects\n');
  });
  it('-l shows a long listing', () => {
    const out = strip(run(['ls -l']).stdout).split('\n');
    expect(out[0]).toMatch(/^total \d+$/);
    expect(out).toContainEqual(expect.stringMatching(/^drwxr-xr-x\s+\d+ you you\s+4096 .* projects$/));
    expect(out).toContainEqual(expect.stringMatching(/^-rw-r--r--\s+1 you you\s+6 .* notes\.txt$/));
  });
  it('accepts combined flags in any order', () => {
    expect(strip(run(['ls -la']).stdout)).toContain('.bashrc');
    expect(strip(run(['ls -al']).stdout)).toContain('.bashrc');
    expect(strip(run(['ls -l -a']).stdout)).toContain('.bashrc');
  });
  it('lists another folder', () => {
    expect(strip(run(['ls projects']).stdout)).toBe('app  readme.md\n');
  });
  it('prints one per line when piped or redirected', () => {
    const r = run(['ls > files.txt']);
    const f = readFile(r.state.root, at(r.state, 'files.txt'));
    expect(f.ok && f.value).toBe('b.txt\nempty\nfiles.txt\nnotes.txt\nprojects\n');
  });
  it('errors on missing paths with exit 2', () => {
    const r = run(['ls ghost']);
    expect(r.stderr).toBe("ls: cannot access 'ghost': No such file or directory");
    expect(r.exitCode).toBe(2);
  });
  it('rejects unknown flags', () => {
    const r = run(['ls -z']);
    expect(r.stderr).toBe("ls: invalid option -- 'z'\nTry 'ls --help' for more information.");
    expect(r.exitCode).toBe(2);
  });
  it('expands globs', () => {
    expect(strip(run(['ls *.txt']).stdout)).toBe('b.txt  notes.txt\n');
  });
});

describe('cat and echo', () => {
  it('prints file contents', () => {
    expect(run(['cat notes.txt']).stdout).toBe('hello\n');
    expect(run(['cat notes.txt b.txt']).stdout).toBe('hello\nb\n');
  });
  it('errors on missing files and folders', () => {
    expect(run(['cat ghost.txt']).stderr).toBe('cat: ghost.txt: No such file or directory');
    expect(run(['cat projects']).stderr).toBe('cat: projects: Is a directory');
  });
  it('echo joins its arguments', () => {
    expect(run(['echo hello   world']).stdout).toBe('hello world\n');
    expect(run(['echo "hello   world"']).stdout).toBe('hello   world\n');
    expect(run(['echo -n hi']).stdout).toBe('hi');
  });
  it('expands variables except in single quotes', () => {
    expect(run(['echo $HOME']).stdout).toBe(`${H}\n`);
    expect(run(['echo "$USER is here"']).stdout).toBe('you is here\n');
    expect(run(["echo '$HOME'"]).stdout).toBe('$HOME\n');
    expect(run(['echo ~']).stdout).toBe(`${H}\n`);
  });
});

describe('mkdir and touch', () => {
  it('creates folders and files', () => {
    const r = run(['mkdir notes', 'touch todo.txt']);
    expect(exists(r.state.root, at(r.state, 'notes'))).toBe(true);
    expect(exists(r.state.root, at(r.state, 'todo.txt'))).toBe(true);
  });
  it('mkdir errors when it exists or parents are missing', () => {
    expect(run(['mkdir projects']).stderr).toBe("mkdir: cannot create directory 'projects': File exists");
    expect(run(['mkdir a/b']).stderr).toBe("mkdir: cannot create directory 'a/b': No such file or directory");
    expect(run(['mkdir -p a/b']).stderr).toBe('');
  });
  it('mkdir with no operand', () => {
    expect(run(['mkdir']).stderr).toContain('mkdir: missing operand');
  });
  it('touch errors when the folder is missing', () => {
    expect(run(['touch nope/x.txt']).stderr).toBe("touch: cannot touch 'nope/x.txt': No such file or directory");
  });
});

describe('rm', () => {
  it('removes files', () => {
    const r = run(['rm notes.txt']);
    expect(exists(r.state.root, at(r.state, 'notes.txt'))).toBe(false);
  });
  it('refuses folders without -r', () => {
    expect(run(['rm projects']).stderr).toBe("rm: cannot remove 'projects': Is a directory");
  });
  it('removes folders with -r and -rf', () => {
    expect(exists(run(['rm -r projects']).state.root, at(seed, 'projects'))).toBe(false);
    expect(exists(run(['rm -rf projects']).state.root, at(seed, 'projects'))).toBe(false);
  });
  it('errors on missing files unless -f', () => {
    expect(run(['rm ghost']).stderr).toBe("rm: cannot remove 'ghost': No such file or directory");
    expect(run(['rm -f ghost']).exitCode).toBe(0);
  });
  it('protects /', () => {
    expect(run(['rm -rf /']).stderr).toContain("it is dangerous to operate recursively on '/'");
  });
  it('removes globbed files', () => {
    const r = run(['rm *.txt']);
    expect(exists(r.state.root, at(r.state, 'b.txt'))).toBe(false);
    expect(exists(r.state.root, at(r.state, 'notes.txt'))).toBe(false);
  });
});

describe('cp and mv', () => {
  it('copies and renames', () => {
    const r = run(['cp notes.txt copy.txt', 'mv b.txt c.txt']);
    expect(exists(r.state.root, at(r.state, 'copy.txt'))).toBe(true);
    expect(exists(r.state.root, at(r.state, 'b.txt'))).toBe(false);
    expect(exists(r.state.root, at(r.state, 'c.txt'))).toBe(true);
  });
  it('cp needs -r for folders', () => {
    expect(run(['cp projects backup']).stderr).toBe("cp: -r not specified; omitting directory 'projects'");
    const r = run(['cp -r projects backup']);
    expect(exists(r.state.root, at(r.state, 'backup/app/main.js'))).toBe(true);
  });
  it('errors on missing sources', () => {
    expect(run(['cp ghost x']).stderr).toBe("cp: cannot stat 'ghost': No such file or directory");
    expect(run(['mv ghost x']).stderr).toBe("mv: cannot stat 'ghost': No such file or directory");
  });
  it('moves several files into a folder', () => {
    const r = run(['mv notes.txt b.txt empty']);
    expect(exists(r.state.root, at(r.state, 'empty/notes.txt'))).toBe(true);
    expect(exists(r.state.root, at(r.state, 'empty/b.txt'))).toBe(true);
  });
});

describe('shell features', () => {
  it('reports unknown commands with exit 127', () => {
    const r = run(['frobnicate']);
    expect(r.stderr).toBe('bash: frobnicate: command not found');
    expect(r.exitCode).toBe(127);
  });
  it('runs && only after success', () => {
    const ok = run(['mkdir out && cd out']);
    expect(bash.prompt(ok.state)).toBe('you@hermit:~/out$ ');
    const bad = run(['cd ghost && mkdir never']);
    expect(exists(bad.state.root, at(bad.state, 'never'))).toBe(false);
  });
  it('runs ; regardless', () => {
    const r = run(['cd ghost; mkdir always']);
    expect(exists(r.state.root, at(r.state, 'always'))).toBe(true);
  });
  it('redirects and appends', () => {
    const r = run(['echo one > log.txt', 'echo two >> log.txt']);
    const f = readFile(r.state.root, at(r.state, 'log.txt'));
    expect(f.ok && f.value).toBe('one\ntwo\n');
  });
  it('feeds files with <', () => {
    expect(run(['cat < notes.txt']).stdout).toBe('hello\n');
  });
  it('pipes text', () => {
    expect(run(['echo hi | cat']).stdout).toBe('hi\n');
  });
  it('reports syntax errors', () => {
    expect(run(['ls |']).stderr).toBe("bash: syntax error near unexpected token `newline'");
    expect(run(['echo "oops']).stderr).toContain('unexpected EOF');
  });
  it('clear emits a clear effect', () => {
    expect(run(['clear']).effects).toEqual([{ kind: 'clear' }]);
  });
  it('never mutates the input state', () => {
    run(['rm -rf projects', 'mkdir x', 'echo hi > notes.txt']);
    expect(exists(seed.root, at(seed, 'projects/app/main.js'))).toBe(true);
    const f = readFile(seed.root, at(seed, 'notes.txt'));
    expect(f.ok && f.value).toBe('hello\n');
  });
});
