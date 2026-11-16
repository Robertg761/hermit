import type { ITheme } from '@xterm/xterm';
import type { OS } from '../../domain/types';

export const terminalThemes: Record<OS, ITheme> = {
  // Ubuntu-ish: dark purple-black
  linux: {
    background: '#2b0b25',
    foreground: '#eeeeec',
    cursor: '#eeeeec',
    selectionBackground: '#6b3a60',
    blue: '#729fcf',
    brightBlue: '#8fb8ef',
    green: '#8ae234',
    brightGreen: '#a6f05a',
    red: '#ef2929',
    brightRed: '#ff6b6b',
    yellow: '#fce94f',
  },
  // Terminal.app-ish dark
  mac: {
    background: '#1e1e1e',
    foreground: '#e6e6e6',
    cursor: '#c7c7c7',
    selectionBackground: '#4a4a4a',
    blue: '#6a9ff5',
    brightBlue: '#8cb6ff',
    green: '#5fd068',
    red: '#ff6159',
    brightRed: '#ff8a80',
  },
  // PowerShell blue
  windows: {
    background: '#012456',
    foreground: '#eeedf0',
    cursor: '#fedba9',
    selectionBackground: '#2a4d84',
    blue: '#5f9ee8',
    brightBlue: '#8ab8ff',
    green: '#4ec95e',
    red: '#f05050',
    brightRed: '#ff7b7b',
    yellow: '#f9f1a5',
  },
};
