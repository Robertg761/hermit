import type { CommandResult, MachineState, OS } from '../types';

/**
 * Easter eggs: the things builders type to poke at a fake terminal.
 * They never cost a heart, and each one found counts toward "Secrets found".
 */
export const SECRET_IDS = ['nuke', 'editor', 'fetch', 'sl', 'cowsay', 'fortune', 'sandwich', 'exit'] as const;
export type SecretId = (typeof SECRET_IDS)[number];

type Egg = {
  readonly id: SecretId;
  readonly test: (line: string, os: OS) => boolean;
  readonly run: (line: string, os: OS, state: MachineState) => Pick<CommandResult, 'stdout' | 'stderr' | 'exitCode'>;
};

const posix = (os: OS): boolean => os !== 'windows';
const words = (line: string): string[] => line.trim().split(/\s+/);

const CRAB = [
  '      _~^~^~_      ',
  "  \\) /  o o  \\ (/  ",
  "    '_   -   _'    ",
  "    / '-----' \\    ",
];

const SHELL_NAME: Readonly<Record<OS, string>> = { linux: 'bash 5.2.21', mac: 'zsh 5.9', windows: 'PowerShell 7.4.6' };
const OS_NAME: Readonly<Record<OS, string>> = { linux: 'Hermit Linux x86_64', mac: 'macOS Hermit 15.1 arm64', windows: 'Windows 11 Hermit Edition' };

const FORTUNES = [
  'You will type `ls` many times today. This is normal.',
  'A clean `git status` is in your future.',
  'The file you are looking for is in the folder you did not check.',
  'Read the error message. The error message wants to help.',
  'Today is a good day to learn what `-r` means.',
];

const bubble = (text: string): string => {
  const t = text === '' ? 'Hello from the tide pool!' : text;
  const bar = '_'.repeat(t.length + 2);
  const low = '-'.repeat(t.length + 2);
  return [` ${bar}`, `< ${t} >`, ` ${low}`, '        \\', '         \\', ...CRAB.map((l) => `      ${l}`)].join('\n') + '\n';
};

const EGGS: readonly Egg[] = [
  {
    id: 'nuke',
    test: (line, os) => {
      const w = words(line).filter((x) => x !== 'sudo');
      const recursive = w.some((x) => /^-[a-zA-Z]*[rR]/.test(x) || x === '--recursive' || /^-r(e(c(u(r(s(e)?)?)?)?)?)?$/i.test(x));
      if (posix(os)) return w[0] === 'rm' && recursive && (w.includes('/') || w.includes('/*'));
      const removers = ['remove-item', 'rm', 'del', 'ri', 'rd', 'rmdir', 'erase'];
      return removers.includes((w[0] ?? '').toLowerCase()) && recursive && w.some((x) => /^["']?C:\\?\*?["']?$/i.test(x));
    },
    run: (line, os) => ({
      stdout: '',
      stderr:
        os === 'linux' && !line.includes('--no-preserve-root')
          ? "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe"
          : 'Nice try. This is a simulation, and Shellby has hidden the drive.',
      exitCode: 1,
    }),
  },
  {
    id: 'editor',
    test: (line, os) => (posix(os) ? /^(sudo\s+)?(vim?|nvim|nano|emacs)(\s|$)/.test(line.trim()) : /^notepad(\.exe)?(\s|$)/i.test(line.trim())),
    run: (line, os) => {
      const name = words(line).find((w) => w !== 'sudo') ?? 'vim';
      if (os === 'windows') return { stdout: 'Notepad opened in another window. Shellby closed it, because this is a simulation.\n', stderr: '', exitCode: 0 };
      if (name === 'nano') return { stdout: 'nano is the friendly one: the shortcuts are listed at the bottom. Ctrl+X leaves.\n(Shellby pressed Ctrl+X for you.)\n', stderr: '', exitCode: 0 };
      if (name === 'emacs') return { stdout: 'emacs is a whole operating system. Ctrl+X then Ctrl+C leaves.\n(Shellby pressed them for you.)\n', stderr: '', exitCode: 0 };
      return {
        stdout: `~\n~\n~\n~                 You opened ${name}. Many enter. Few leave.\n~\n(Shellby typed :q! for you. Remember it: press Esc, then type :q! and Enter.)\n`,
        stderr: '',
        exitCode: 0,
      };
    },
  },
  {
    id: 'fetch',
    test: (line) => /^(neofetch|fastfetch|screenfetch|winfetch)(\s|$)/i.test(line.trim()),
    run: (_line, os, state) => {
      const user = state.env['USER'] ?? state.env['USERNAME'] ?? 'you';
      const info = [
        `${user}@hermit`,
        '-'.repeat(user.length + 7),
        `OS: ${OS_NAME[os]}`,
        `Shell: ${SHELL_NAME[os]}`,
        'Uptime: since you opened this tab',
        `Processes: ${state.processes.length}`,
        'Crabs: 1',
        'Memory: plenty, it is all imaginary',
      ];
      const art = ['', ...CRAB, '', '', '', ''];
      return { stdout: info.map((l, i) => `${art[i] ?? ''.padEnd(19)}   ${l}`).join('\n') + '\n', stderr: '', exitCode: 0 };
    },
  },
  {
    id: 'sl',
    test: (line) => /^sl(\s|$)/.test(line.trim()),
    run: () => ({
      stdout: `You meant ls. Instead, a crab scuttles past:\n\n${CRAB.map((l) => `                    ${l}`).join('\n')}\n        ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~\n`,
      stderr: '',
      exitCode: 0,
    }),
  },
  {
    id: 'cowsay',
    test: (line) => /^(cowsay|crabsay)(\s|$)/.test(line.trim()),
    run: (line) => ({ stdout: `No cows here.\n${bubble(words(line).slice(1).join(' ').replace(/^["']|["']$/g, ''))}`, stderr: '', exitCode: 0 }),
  },
  {
    id: 'fortune',
    test: (line) => /^fortune(\s|$)/.test(line.trim()),
    run: (_line, _os, state) => ({ stdout: `${FORTUNES[state.processes.length % FORTUNES.length] ?? ''}\n`, stderr: '', exitCode: 0 }),
  },
  {
    id: 'sandwich',
    test: (line) => /^(sudo\s+)?make\s+me\s+a\s+sandwich\s*$/i.test(line.trim()),
    run: (line) => (line.trim().startsWith('sudo') ? { stdout: 'Okay.\n', stderr: '', exitCode: 0 } : { stdout: 'What? Make it yourself.\n', stderr: '', exitCode: 0 }),
  },
  {
    id: 'exit',
    test: (line) => /^(exit|logout|quit)(\s|$)/i.test(line.trim()),
    run: () => ({ stdout: "You can't leave. You have a streak.\n", stderr: '', exitCode: 0 }),
  },
];

/** Run a line as an easter egg, if it is one. The machine state never changes. */
export const runEgg = (os: OS, line: string, state: MachineState): CommandResult | undefined => {
  const egg = EGGS.find((e) => e.test(line, os));
  if (egg === undefined) return undefined;
  return { ...egg.run(line, os, state), state, effects: [{ kind: 'easterEgg', id: egg.id }] };
};

export const isSecretId = (id: string): id is SecretId => (SECRET_IDS as readonly string[]).includes(id);
