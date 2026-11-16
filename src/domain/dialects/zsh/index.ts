import { posixCommands } from '../bash/commands';
import { formatPosixPath, parsePosixPath } from '../bash/paths';
import { runLine, type ShellConfig } from '../bash/run';
import type { Dialect } from '../dialect';
import type { MachineState } from '../../types';
import { macCommands } from './commands';

export const zshConfig: ShellConfig = {
  shellName: 'zsh',
  commands: { ...posixCommands('bsd'), ...macCommands },
  aliases: { ll: 'ls -l', la: 'ls -A' },
  notFound: (name) => `zsh: command not found: ${name}`,
  nomatchError: true,
};

/** zsh's default macOS prompt shows only the last folder (`%1~`). */
const shortDir = (state: MachineState): string => {
  const { cwd, home } = state;
  if (cwd.length === home.length && home.every((s, i) => cwd[i] === s)) return '~';
  return cwd[cwd.length - 1] ?? '/';
};

export const zsh: Dialect = {
  os: 'mac',
  prompt: (state) => `you@Hermits-MacBook ${shortDir(state)} % `,
  formatPath: formatPosixPath,
  parsePath: parsePosixPath,
  caseInsensitive: false,
  commands: zshConfig.commands,
  aliases: zshConfig.aliases,
  run: (line, state) => runLine(line, state, zshConfig),
};
