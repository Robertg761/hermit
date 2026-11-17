import { describe, expect, it } from 'vitest';
import { parseAnsi, stripAnsi } from './ansi';

describe('parseAnsi', () => {
  it('turns ls colours into spans', () => {
    expect(parseAnsi('notes.txt  \x1b[1;34mphotos\x1b[0m')).toEqual([
      { text: 'notes.txt  ', bold: false, colour: null },
      { text: 'photos', bold: true, colour: 'blue' },
    ]);
  });
  it('strips codes', () => {
    expect(stripAnsi('\x1b[1;32mbuild.sh\x1b[0m')).toBe('build.sh');
  });
});
