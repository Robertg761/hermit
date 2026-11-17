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

/** The word the shell didn't recognise as a command, if that was the error. */
export const notFoundName = (stderr: string): string | undefined =>
  /^bash: (.+): command not found/m.exec(stderr)?.[1] ??
  /^zsh: command not found: (.+)$/m.exec(stderr)?.[1] ??
  /^(.+): The term '.+' is not recognized/m.exec(stderr)?.[1];

const MISSING_OPERAND: Readonly<Record<string, string>> = {
  cp: '`cp` needs two names: what to copy, then where to put it. Like `cp notes.txt backup.txt`.',
  mv: '`mv` needs two names: what to move, then where it goes. Like `mv notes.txt projects`.',
  mkdir: '`mkdir` needs a name for the new folder. Like `mkdir drafts`.',
  touch: '`touch` needs a name for the new file. Like `touch todo.txt`.',
  rm: '`rm` needs the name of what to delete.',
  rmdir: '`rmdir` needs the name of the empty folder to delete.',
  cat: '`cat` needs the name of a file to show.',
  grep: '`grep` needs a word to look for, then a file to look in. Like `grep shell notes.txt`.',
  chmod: '`chmod` needs a change and a file name. Like `chmod +x run.sh`.',
  kill: '`kill` needs the number (PID) of the program to stop. `ps` lists them.',
};

export const decodeError = (os: OS, stderr: string, isCommand: (name: string) => boolean): string | undefined => {
  const list = os === 'windows' ? 'Get-ChildItem' : 'ls';

  const notFound = notFoundName(stderr);
  if (notFound !== undefined) {
    const fixed = gluedFlag(notFound, isCommand);
    if (fixed !== undefined) return `Commands and flags need a space between them: \`${fixed}\`.`;
    if (os !== 'windows' && notFound !== notFound.toLowerCase() && isCommand(notFound.toLowerCase())) {
      return `Capital letters matter here. Commands are lower case: \`${notFound.toLowerCase()}\`.`;
    }
    if (/\.(sh|ps1)$/.test(notFound) && !/[\\/]/.test(notFound)) {
      return os === 'windows'
        ? `To run a script in the folder you're in, start with \`.\\\`: \`.\\${notFound}\`.`
        : `To run a script in the folder you're in, start with \`./\`: \`./${notFound}\`.`;
    }
    return `There's no command called \`${notFound}\`. Check the spelling.`;
  }

  if (/unexpected EOF while looking for matching|unmatched [\"']|The string is missing the terminator/.test(stderr)) {
    return 'A quote was opened but never closed. Quotes come in pairs, like `"my file.txt"`.';
  }

  if (/^(?:bash|zsh): (?:\.\/)?(.+?): Permission denied|^zsh: permission denied: /m.test(stderr)) {
    return "That file isn't allowed to run yet. `chmod +x` gives it permission to run.";
  }
  if (/running scripts is disabled on this system/.test(stderr)) {
    return 'Windows blocks scripts until you allow them. `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` allows your own.';
  }

  // `cat my file.txt`: a space split one name into two.
  const missingCount = (stderr.match(/No such file or directory|no such file or directory/g) ?? []).length;
  if (missingCount >= 2) {
    return 'Spaces split names apart. For a name with a space in it, wrap it in quotes, like `"my file.txt"`.';
  }
  if (/A positional parameter cannot be found that accepts argument/.test(stderr)) {
    return 'PowerShell got one word too many. If a name has a space in it, wrap it in quotes, like `"my file.txt"`.';
  }

  const operand = /^(\w+): missing (?:destination )?(?:file )?operand/m.exec(stderr)?.[1] ?? /^usage: (\w+)/im.exec(stderr)?.[1] ?? /^(kill): usage:/m.exec(stderr)?.[1];
  if (operand !== undefined) return MISSING_OPERAND[operand] ?? `\`${operand}\` needs more after it. Check the lesson's example.`;
  const mandatory = /^([\w-]+): Cannot process command because of one or more missing mandatory parameters: (.+?)\.?$/m.exec(stderr);
  if (mandatory !== null) return `\`${mandatory[1] ?? ''}\` needs more after it: a value for \`-${(mandatory[2] ?? '').split(' ')[0] ?? ''}\`. Check the lesson's example.`;

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
