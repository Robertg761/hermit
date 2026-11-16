import type { OS } from '../types';

/**
 * The error decoder: a plain-English line under the real error, for the errors beginners
 * hit most. Reading errors is a terminal skill, so Hermit explains them instead of hiding them.
 */

const lastSegment = (path: string): string => path.split(/[\\/]/).filter((s) => s !== '').pop() ?? path;

/** `ls-a` or `Get-ChildItem-Force`: a known command glued to a flag. */
const gluedFlag = (name: string, isCommand: (n: string) => boolean): string | undefined => {
  for (let i = name.indexOf('-'); i > 0; i = name.indexOf('-', i + 1)) {
    const cmd = name.slice(0, i);
    if (isCommand(cmd)) return `${cmd} ${name.slice(i)}`;
  }
  return undefined;
};

export const decodeError = (os: OS, stderr: string, isCommand: (name: string) => boolean): string | undefined => {
  const list = os === 'windows' ? 'Get-ChildItem' : 'ls';

  const notFound =
    /^bash: (.+): command not found/m.exec(stderr)?.[1] ??
    /^zsh: command not found: (.+)$/m.exec(stderr)?.[1] ??
    /^(.+): The term '.+' is not recognized/m.exec(stderr)?.[1];
  if (notFound !== undefined) {
    const fixed = gluedFlag(notFound, isCommand);
    if (fixed !== undefined) return `Commands and flags need a space between them: \`${fixed}\`.`;
    return `There's no command called \`${notFound}\`. Check the spelling.`;
  }

  const notDir = /cd: (.+): Not a directory/.exec(stderr)?.[1] ?? /cd: not a directory: (.+)$/m.exec(stderr)?.[1];
  if (notDir !== undefined) return `\`${lastSegment(notDir)}\` is a file. You can only \`cd\` into folders.`;

  const isDir =
    /^cat: (.+): Is a directory/m.exec(stderr)?.[1] ?? /Unable to get content because it is a directory: '(.+?)'/.exec(stderr)?.[1];
  if (isDir !== undefined) return `\`${lastSegment(isDir)}\` is a folder, not a file. Use \`${list}\` to look inside it.`;

  if (/^rm: (cannot remove '.+': Is a directory|.+: is a directory)/m.test(stderr)) {
    return '`rm` only deletes files on its own. A folder needs `-r` (recursive).';
  }
  if (/has children and the Recurse parameter was not specified/.test(stderr)) {
    return 'That folder still has things inside. Add `-Recurse` to delete it and everything in it.';
  }

  const missing =
    /: (?:cannot access '(.+?)'|([^:']+?)): No such file or directory/.exec(stderr) ??
    /: no such file or directory: (.+)$/m.exec(stderr) ??
    /Cannot find path '(.+?)' because it does not exist/.exec(stderr);
  if (missing !== null) {
    const name = missing[1] ?? missing[2] ?? '';
    return `Nothing called \`${lastSegment(name)}\` here. Run \`${list}\` to see what's actually there.`;
  }

  const badParam = /A parameter cannot be found that matches parameter name '(.+?)'/.exec(stderr)?.[1];
  if (badParam !== undefined) return `That command has no \`-${badParam}\` parameter. Check the spelling, or the lesson's hint.`;

  const badFlag = /invalid option -- '?(\w)'?/.exec(stderr)?.[1];
  if (badFlag !== undefined) return `That command has no \`-${badFlag}\` flag.`;

  return undefined;
};
