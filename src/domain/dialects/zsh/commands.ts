import { inputText, result, type CommandHandler } from '../dialect';

const CLIPBOARD = 'HERMIT_CLIPBOARD';

/** macOS-only commands layered on top of the shared POSIX ones. */
export const macCommands: Readonly<Record<string, CommandHandler>> = {
  say: (args, input, state) => {
    const text = args.filter((a) => !a.startsWith('-')).join(' ') || (inputText(input) ?? '').trim();
    if (text.length === 0) return result(state);
    return result(state, { effects: [{ kind: 'speak', text }] });
  },
  open: (args, _input, state) => {
    if (args.length === 0) return result(state, { stderr: 'Usage: open [-e] [-t] [-f] [-W] [-R] [-n] [-g] [-h] [-s <partial SDK name>][-b <bundle identifier>] [-a <application>] [-u URL] [filenames] [--args arguments]' });
    return result(state, { effects: [{ kind: 'easterEgg', id: `open:${args.join(' ')}` }] });
  },
  pbcopy: (_args, input, state) => {
    const text = inputText(input) ?? '';
    return result({ ...state, env: { ...state.env, [CLIPBOARD]: text } }, { effects: [{ kind: 'clipboard', text }] });
  },
  pbpaste: (_args, _input, state) => result(state, { stdout: state.env[CLIPBOARD] ?? '' }),
  sw_vers: (_args, _input, state) =>
    result(state, { stdout: 'ProductName:\t\tmacOS\nProductVersion:\t\t26.1\nBuildVersion:\t\t25B78\n' }),
  caffeinate: (_args, _input, state) => result(state, { stdout: '' }),
};
