import { describe, expect, it } from 'vitest';
import { buildMachine, type SeedState } from '../../machine';
import type { MachineState } from '../../types';
import { bash } from './index';
import { zsh } from '../zsh';
import { exists } from '../../vfs/vfs';

const seed: SeedState = {
  files: {
    'app.js': 'const a = 1;\n// TODO: tidy\nconsole.log(a);\n',
    'src/util.js': '// TODO: test\nexport const x = 2;\n',
    'logs/today.log': 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\ntwelve\n',
    'logs/old.log': 'old\n',
    'names.txt': 'sam\nalex\nsam\nkim\nalex\n',
    'build.sh': '#!/bin/bash\nmkdir -p dist\necho "Build complete"\n',
  },
  processes: [{ pid: 4242, name: 'runaway', cpu: 99.2 }, { pid: 1201, name: 'music', cpu: 1.5 }],
};
const fresh = (os: 'linux' | 'mac' = 'linux'): MachineState => buildMachine(os, seed);
const run = (line: string, state = fresh()) => bash.run(line, state);
const runZ = (line: string, state = fresh('mac')) => zsh.run(line, state);

describe('grep', () => {
  it('prints matching lines of one file', () => {
    expect(run('grep TODO app.js').stdout).toBe('// TODO: tidy\n');
  });
  it('searches folders with -r and prefixes file names', () => {
    expect(run('grep -r TODO .').stdout).toBe('./app.js:// TODO: tidy\n./src/util.js:// TODO: test\n');
    expect(run('grep -r TODO').stdout).toBe('app.js:// TODO: tidy\nsrc/util.js:// TODO: test\n');
  });
  it('supports -i, -n, -c, -v and stdin', () => {
    expect(run('grep -in todo app.js').stdout).toBe('2:// TODO: tidy\n');
    expect(run('grep -c a names.txt').stdout).toBe('4\n');
    expect(run('cat names.txt | grep kim').stdout).toBe('kim\n');
    expect(run('grep -v sam names.txt').stdout).toBe('alex\nkim\nalex\n');
  });
  it('exits 1 on no match and 2 on a missing file', () => {
    expect(run('grep zebra app.js').exitCode).toBe(1);
    const r = run('grep TODO nope.js');
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toBe('grep: nope.js: No such file or directory');
    expect(run('grep TODO src').stderr).toBe('grep: src: Is a directory');
  });
});

describe('find', () => {
  it('finds by name with globs', () => {
    expect(run('find . -name "*.log"').stdout).toBe('./logs/old.log\n./logs/today.log\n');
    expect(run('find logs -type f').stdout).toBe('logs/old.log\nlogs/today.log\n');
  });
  it('GNU and BSD errors differ', () => {
    expect(run('find nope -name x').stderr).toBe('find: ‘nope’: No such file or directory');
    expect(runZ('find nope -name x').stderr).toBe('find: nope: No such file or directory');
    expect(runZ('find -name x').exitCode).toBe(1);
  });
});

describe('head, tail, wc', () => {
  it('head and tail default to 10 lines and take -n', () => {
    expect(run('head logs/today.log').stdout.split('\n')).toHaveLength(11);
    expect(run('head -n 2 logs/today.log').stdout).toBe('one\ntwo\n');
    expect(run('head -3 logs/today.log').stdout).toBe('one\ntwo\nthree\n');
    expect(run('tail -n 2 logs/today.log').stdout).toBe('eleven\ntwelve\n');
  });
  it('wc -l matches GNU and BSD padding', () => {
    expect(run('wc -l names.txt').stdout).toBe('5 names.txt\n');
    expect(runZ('wc -l names.txt').stdout).toBe('       5 names.txt\n');
    expect(run('cat names.txt | wc -l').stdout).toBe('5\n');
  });
});

describe('sort and uniq', () => {
  it('sorts and dedupes', () => {
    expect(run('sort names.txt').stdout).toBe('alex\nalex\nkim\nsam\nsam\n');
    expect(run('sort names.txt | uniq').stdout).toBe('alex\nkim\nsam\n');
    expect(run('sort -u names.txt').stdout).toBe('alex\nkim\nsam\n');
    expect(run('sort names.txt | uniq -c').stdout).toBe('      2 alex\n      1 kim\n      2 sam\n');
    expect(run('sort -r names.txt').stdout.split('\n')[0]).toBe('sam');
  });
});

describe('processes', () => {
  it('ps aux lists everything, including the runaway', () => {
    const out = run('ps aux').stdout;
    expect(out.split('\n')[0]).toContain('USER');
    expect(out).toContain('99.2');
    expect(out).toContain('runaway');
  });
  it('pgrep -l finds by name', () => {
    expect(run('pgrep -l runaway').stdout).toBe('4242 runaway\n');
    expect(run('pgrep nothing').exitCode).toBe(1);
  });
  it('kill and pkill stop programs', () => {
    expect(run('kill 4242').state.processes.some((p) => p.name === 'runaway')).toBe(false);
    expect(run('kill -9 4242').state.processes.some((p) => p.name === 'runaway')).toBe(false);
    expect(run('pkill runaway').state.processes.some((p) => p.name === 'runaway')).toBe(false);
    expect(run('kill 999').stderr).toBe('bash: kill: (999) - No such process');
    expect(runZ('kill 999').stderr).toBe('kill: kill 999 failed: no such process');
  });
});

describe('scripts, chmod and sudo', () => {
  it('a script without the executable bit is refused', () => {
    expect(run('./build.sh').stderr).toBe('bash: ./build.sh: Permission denied');
    expect(run('./build.sh').exitCode).toBe(126);
    expect(runZ('./build.sh').stderr).toBe('zsh: permission denied: ./build.sh');
  });
  it('chmod +x makes it runnable', () => {
    const r = run('chmod +x build.sh && ./build.sh');
    expect(r.stdout).toBe('Build complete\n');
    expect(exists(r.state.root, ['home', 'you', 'dist'])).toBe(true);
  });
  it('bash script.sh runs it without the bit', () => {
    expect(run('bash build.sh').stdout).toBe('Build complete\n');
  });
  it('missing scripts', () => {
    expect(run('./nope.sh').stderr).toBe('bash: ./nope.sh: No such file or directory');
  });
  it('sudo runs the command as admin, once', () => {
    expect(run('kill 1').exitCode).toBe(1);
    const r = run('sudo kill 1');
    expect(r.exitCode).toBe(0);
    expect(r.state.isAdmin).toBe(false);
  });
});
