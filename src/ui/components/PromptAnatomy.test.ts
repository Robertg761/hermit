import { describe, expect, it } from 'vitest';
import { promptParts } from './PromptAnatomy';

describe('promptParts', () => {
  it('labels each OS prompt', () => {
    expect(promptParts('linux', 'you@hermit:~$ ')?.map((p) => p.label ?? p.text)).toEqual(['who you are', '@', 'which computer', ':', 'where you are', 'your turn']);
    expect(promptParts('mac', 'you@Hermits-MacBook ~ % ')?.filter((p) => p.label !== undefined).map((p) => p.text)).toEqual(['you', 'Hermits-MacBook', '~', ' %']);
    expect(promptParts('windows', 'PS C:\\Users\\you> ')?.filter((p) => p.label !== undefined).map((p) => p.text)).toEqual(['PS', 'C:\\Users\\you', '>']);
  });
});
