import type { Dialect } from '../dialect';
import { bashCommands } from './commands';
import { posixTools } from './tools';
import { formatPosixPath, parsePosixPath, tildePath } from './paths';
import { runLine, type ShellConfig } from './run';

export const bashConfig: ShellConfig = {
  shellName: 'bash',
  commands: { ...bashCommands, ...posixTools('gnu') },
  aliases: { ll: 'ls -l', la: 'ls -A' },
  notFound: (name) => `bash: ${name}: command not found`,
};

export const bash: Dialect = {
  os: 'linux',
  prompt: (state) => `you@hermit:${tildePath(state)}$ `,
  formatPath: formatPosixPath,
  parsePath: parsePosixPath,
  caseInsensitive: false,
  commands: bashConfig.commands,
  aliases: bashConfig.aliases,
  run: (line, state) => runLine(line, state, bashConfig),
};
