import { describe, expect, it } from 'vitest';
import {
  caseInsensitive,
  copy,
  dir,
  exists,
  file,
  getNode,
  listDir,
  mkdir,
  move,
  normalize,
  readFile,
  remove,
  rmdir,
  touch,
  walk,
  writeFile,
} from './vfs';

const root = dir({
  home: dir({
    you: dir({
      'notes.txt': file('hello\n'),
      '.secret': file('shh'),
      projects: dir({ app: dir({ 'main.js': file('code') }) }),
    }),
  }),
});
const H = ['home', 'you'];

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

describe('normalize', () => {
  it('resolves . and ..', () => {
    expect(normalize(['a', '.', 'b', '..', 'c'])).toEqual(['a', 'c']);
  });
  it('stops at root', () => {
    expect(normalize(['..', '..', 'a'])).toEqual(['a']);
  });
});

describe('getNode / readFile / listDir', () => {
  it('reads a file', () => {
    expect(unwrap(readFile(root, [...H, 'notes.txt']))).toBe('hello\n');
  });
  it('reports ENOENT for missing paths', () => {
    const r = getNode(root, [...H, 'nope']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ENOENT');
  });
  it('reports EISDIR when reading a directory', () => {
    const r = readFile(root, [...H, 'projects']);
    expect(!r.ok && r.error.code).toBe('EISDIR');
  });
  it('reports ENOTDIR when walking through a file', () => {
    const r = getNode(root, [...H, 'notes.txt', 'x']);
    expect(!r.ok && r.error.code).toBe('ENOTDIR');
  });
  it('lists sorted entries', () => {
    expect(unwrap(listDir(root, H)).map(([n]) => n)).toEqual(['.secret', 'notes.txt', 'projects']);
  });
  it('supports case-insensitive lookup', () => {
    expect(exists(root, [...H, 'NOTES.TXT'], caseInsensitive)).toBe(true);
    expect(exists(root, [...H, 'NOTES.TXT'])).toBe(false);
  });
});

describe('writeFile / touch', () => {
  it('creates and appends without mutating the original', () => {
    const a = unwrap(writeFile(root, [...H, 'log.txt'], 'one\n'));
    const b = unwrap(writeFile(a, [...H, 'log.txt'], 'two\n', { append: true }));
    expect(unwrap(readFile(b, [...H, 'log.txt']))).toBe('one\ntwo\n');
    expect(exists(root, [...H, 'log.txt'])).toBe(false);
  });
  it('overwrites', () => {
    const a = unwrap(writeFile(root, [...H, 'notes.txt'], 'new'));
    expect(unwrap(readFile(a, [...H, 'notes.txt']))).toBe('new');
  });
  it('fails when the parent is missing', () => {
    const r = writeFile(root, [...H, 'missing', 'x.txt'], 'x');
    expect(!r.ok && r.error.code).toBe('ENOENT');
  });
  it('touch keeps existing content', () => {
    const a = unwrap(touch(root, [...H, 'notes.txt']));
    expect(unwrap(readFile(a, [...H, 'notes.txt']))).toBe('hello\n');
    const b = unwrap(touch(root, [...H, 'todo.txt']));
    expect(unwrap(readFile(b, [...H, 'todo.txt']))).toBe('');
  });
});

describe('mkdir', () => {
  it('creates a directory', () => {
    const a = unwrap(mkdir(root, [...H, 'notes']));
    expect(getNode(a, [...H, 'notes']).ok).toBe(true);
  });
  it('fails if it exists', () => {
    const r = mkdir(root, [...H, 'projects']);
    expect(!r.ok && r.error.code).toBe('EEXIST');
  });
  it('fails without parents', () => {
    const r = mkdir(root, [...H, 'a', 'b']);
    expect(!r.ok && r.error.code).toBe('ENOENT');
  });
  it('creates parents with the option', () => {
    const a = unwrap(mkdir(root, [...H, 'a', 'b', 'c'], { parents: true }));
    expect(exists(a, [...H, 'a', 'b', 'c'])).toBe(true);
  });
});

describe('remove / rmdir', () => {
  it('removes a file', () => {
    const a = unwrap(remove(root, [...H, 'notes.txt']));
    expect(exists(a, [...H, 'notes.txt'])).toBe(false);
  });
  it('refuses a directory without recursive', () => {
    const r = remove(root, [...H, 'projects']);
    expect(!r.ok && r.error.code).toBe('EISDIR');
  });
  it('removes a directory recursively', () => {
    const a = unwrap(remove(root, [...H, 'projects'], { recursive: true }));
    expect(exists(a, [...H, 'projects'])).toBe(false);
  });
  it('rmdir refuses non-empty directories', () => {
    const r = rmdir(root, [...H, 'projects']);
    expect(!r.ok && r.error.code).toBe('ENOTEMPTY');
  });
});

describe('copy / move', () => {
  it('copies a file', () => {
    const a = unwrap(copy(root, [...H, 'notes.txt'], [...H, 'copy.txt']));
    expect(unwrap(readFile(a, [...H, 'copy.txt']))).toBe('hello\n');
    expect(exists(a, [...H, 'notes.txt'])).toBe(true);
  });
  it('copies into an existing directory', () => {
    const a = unwrap(copy(root, [...H, 'notes.txt'], [...H, 'projects']));
    expect(exists(a, [...H, 'projects', 'notes.txt'])).toBe(true);
  });
  it('needs recursive for directories', () => {
    const r = copy(root, [...H, 'projects'], [...H, 'backup']);
    expect(!r.ok && r.error.code).toBe('EISDIR');
    const a = unwrap(copy(root, [...H, 'projects'], [...H, 'backup'], { recursive: true }));
    expect(exists(a, [...H, 'backup', 'app', 'main.js'])).toBe(true);
  });
  it('refuses to copy a directory into itself', () => {
    const r = copy(root, [...H, 'projects'], [...H, 'projects', 'app'], { recursive: true });
    expect(!r.ok && r.error.code).toBe('EINVAL');
  });
  it('renames', () => {
    const a = unwrap(move(root, [...H, 'notes.txt'], [...H, 'renamed.txt']));
    expect(exists(a, [...H, 'notes.txt'])).toBe(false);
    expect(unwrap(readFile(a, [...H, 'renamed.txt']))).toBe('hello\n');
  });
  it('moves into a directory', () => {
    const a = unwrap(move(root, [...H, 'notes.txt'], [...H, 'projects']));
    expect(exists(a, [...H, 'projects', 'notes.txt'])).toBe(true);
  });
  it('fails for missing sources', () => {
    const r = move(root, [...H, 'ghost'], [...H, 'x']);
    expect(!r.ok && r.error.code).toBe('ENOENT');
  });
});

describe('walk', () => {
  it('visits every node', () => {
    expect(walk(root).length).toBe(8);
  });
});
