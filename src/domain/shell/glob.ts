/** True if the string contains an unescaped glob character. */
export const hasGlob = (s: string): boolean => /[*?[]/.test(s);

const escapeRe = (c: string): string => c.replace(/[.+^${}()|\\/*?[\]]/g, '\\$&');

/** Convert a shell glob (`*`, `?`, `[abc]`) to an anchored RegExp. */
export const globToRegExp = (glob: string, ignoreCase = false): RegExp => {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] ?? '';
    if (c === '\\') {
      re += escapeRe(glob[i + 1] ?? '\\');
      i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const end = glob.indexOf(']', i + 1);
      if (end === -1) {
        re += '\\[';
      } else {
        let cls = glob.slice(i + 1, end);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        re += '[' + cls.replace(/\\/g, '\\\\') + ']';
        i = end;
      }
    } else re += escapeRe(c);
  }
  return new RegExp('^' + re + '$', ignoreCase ? 'i' : '');
};

export const globMatch = (glob: string, name: string, ignoreCase = false): boolean =>
  globToRegExp(glob, ignoreCase).test(name);
