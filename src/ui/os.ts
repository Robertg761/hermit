import type { OS } from '../domain/types';

export const OS_LABEL: Record<OS, string> = { linux: 'Linux', mac: 'macOS', windows: 'Windows' };
export const SHELL_LABEL: Record<OS, string> = { linux: 'Bash', mac: 'zsh', windows: 'PowerShell' };

export const detectOs = (userAgent: string): OS => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'mac';
  return 'linux';
};
