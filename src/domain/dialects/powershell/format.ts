import type { PsObject } from '../dialect';
import { formatWinPath } from './paths';

const DATE = '11/16/2026  6:00 PM';

const fileTable = (items: readonly Extract<PsObject, { type: 'file' }>[]): string => {
  const out: string[] = [];
  let currentDir: string | null = null;
  for (const f of items) {
    const dir = formatWinPath(f.path.slice(0, -1));
    if (dir !== currentDir) {
      if (currentDir !== null) out.push('');
      out.push('', `    Directory: ${dir}`, '', 'Mode                 LastWriteTime         Length Name', '----                 -------------         ------ ----');
      currentDir = dir;
    }
    const mode = (f.isDir ? 'd---' : '-a--') + (f.hidden ? 'h' : '-');
    const mode5 = mode.slice(0, 3) + (f.hidden ? 'h' : '-') + '-';
    const length = f.isDir ? '' : String(f.length);
    out.push(`${mode5.padEnd(15)}${DATE.padStart(19)} ${length.padStart(14)} ${f.name}`);
  }
  out.push('');
  return out.join('\n') + '\n';
};

const processTable = (items: readonly Extract<PsObject, { type: 'process' }>[]): string => {
  const head = [' NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName', ' ------    -----      -----     ------      --  -- -----------'];
  const rows = items.map((p) => `${'12'.padStart(7)} ${'24.50'.padStart(8)} ${'48.20'.padStart(10)} ${p.cpu.toFixed(2).padStart(10)} ${String(p.pid).padStart(7)} ${'1'.padStart(3)} ${p.name}`);
  return '\n' + [...head, ...rows].join('\n') + '\n\n';
};

/** Out-Default: turn the objects left at the end of a pipeline into text. */
export const formatObjects = (objects: readonly PsObject[]): string => {
  let out = '';
  let i = 0;
  while (i < objects.length) {
    const o = objects[i];
    if (o === undefined) break;
    if (o.type === 'file') {
      const group: Extract<PsObject, { type: 'file' }>[] = [];
      while (objects[i]?.type === 'file') {
        const f = objects[i];
        if (f?.type === 'file') group.push(f);
        i++;
      }
      out += fileTable(group);
      continue;
    }
    if (o.type === 'process') {
      const group: Extract<PsObject, { type: 'process' }>[] = [];
      while (objects[i]?.type === 'process') {
        const p = objects[i];
        if (p?.type === 'process') group.push(p);
        i++;
      }
      out += processTable(group);
      continue;
    }
    if (o.type === 'pathInfo') {
      out += `\nPath\n----\n${o.path}\n\n`;
    } else if (o.type === 'matchInfo') {
      out += `${o.path}:${o.lineNumber}:${o.line}\n`;
    } else if (o.type === 'measure') {
      out += `\nLines Words Characters Property\n----- ----- ---------- --------\n${String(o.lines).padStart(5)}\n\n`;
    } else if (o.type === 'number') {
      out += `${o.value}\n`;
    } else {
      out += `${o.value}\n`;
    }
    i++;
  }
  return out;
};

/** The string form of an object, as used for parameter binding and `>` redirects of simple values. */
export const objectToString = (o: PsObject): string => {
  switch (o.type) {
    case 'string':
      return o.value;
    case 'number':
      return String(o.value);
    case 'file':
      return o.name;
    case 'process':
      return `System.Diagnostics.Process (${o.name})`;
    case 'pathInfo':
      return o.path;
    case 'matchInfo':
      return `${o.path}:${o.lineNumber}:${o.line}`;
    case 'measure':
      return 'Microsoft.PowerShell.Commands.TextMeasureInfo';
  }
};

/** Property access for `(expr).Name` and `Select-Object` / `Sort-Object` / `Where-Object`. */
export const getProperty = (o: PsObject, prop: string): PsObject | null => {
  const p = prop.toLowerCase();
  switch (o.type) {
    case 'file':
      if (p === 'name') return { type: 'string', value: o.name };
      if (p === 'fullname') return { type: 'string', value: formatWinPath(o.path) };
      if (p === 'length') return o.isDir ? null : { type: 'number', value: o.length };
      if (p === 'extension') return { type: 'string', value: o.name.includes('.') ? o.name.slice(o.name.lastIndexOf('.')) : '' };
      if (p === 'basename') return { type: 'string', value: o.name.includes('.') ? o.name.slice(0, o.name.lastIndexOf('.')) : o.name };
      return null;
    case 'process':
      if (p === 'name' || p === 'processname') return { type: 'string', value: o.name };
      if (p === 'id') return { type: 'number', value: o.pid };
      if (p === 'cpu') return { type: 'number', value: o.cpu };
      return null;
    case 'pathInfo':
      if (p === 'path') return { type: 'string', value: o.path };
      return null;
    case 'string':
      if (p === 'length') return { type: 'number', value: o.value.length };
      return null;
    case 'matchInfo':
      if (p === 'line') return { type: 'string', value: o.line };
      if (p === 'linenumber') return { type: 'number', value: o.lineNumber };
      if (p === 'path' || p === 'filename') return { type: 'string', value: o.path };
      return null;
    case 'measure':
      if (p === 'lines' || p === 'count') return { type: 'number', value: o.lines };
      return null;
    case 'number':
      return null;
  }
};
