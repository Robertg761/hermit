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

const measureText = (m: Extract<PsObject, { type: 'measure' }>): string => {
  if (m.mode === 'count') {
    const rows = [['Count', String(m.count)], ['Average', ''], ['Sum', ''], ['Maximum', ''], ['Minimum', ''], ['Property', '']];
    return '\n' + rows.map(([k, v]) => `${(k ?? '').padEnd(18)}: ${v ?? ''}`.trimEnd()).join('\n') + '\n\n';
  }
  return `\nLines Words Characters Property\n----- ----- ---------- --------\n${String(m.lines).padStart(5)} ${(m.words > 0 ? String(m.words) : '').padStart(5)} ${(m.chars > 0 ? String(m.chars) : '').padStart(10)}\n\n`.replace(/ +\n/g, '\n');
};

const recordTable = (rows: readonly Extract<PsObject, { type: 'record' }>[]): string => {
  const names = rows[0]?.props.map(([k]) => k) ?? [];
  const cells = rows.map((r) => r.props.map(([, v]) => (v === null ? '' : objectToString(v))));
  const numeric = names.map((_, c) => rows.every((r) => { const v = r.props[c]?.[1]; return v === null || v === undefined || v.type === 'number'; }));
  const widths = names.map((n, c) => Math.max(n.length, ...cells.map((row) => (row[c] ?? '').length)));
  const fmt = (vals: readonly string[], align: boolean): string =>
    vals
      .map((v, c) => {
        const w = widths[c] ?? 0;
        const last = c === vals.length - 1;
        return align && numeric[c] === true ? v.padStart(w) : last ? v : v.padEnd(w);
      })
      .join(' ')
      .trimEnd();
  const lines = [fmt(names, true), fmt(names.map((n) => '-'.repeat(n.length)), true), ...cells.map((row) => fmt(row, true))];
  return '\n' + lines.join('\n') + '\n\n';
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
      out += o.path === '' ? `${o.line}\n` : `${o.path}:${o.lineNumber}:${o.line}\n`;
    } else if (o.type === 'measure') {
      out += measureText(o);
    } else if (o.type === 'record') {
      const group: Extract<PsObject, { type: 'record' }>[] = [];
      while (objects[i]?.type === 'record') {
        const r = objects[i];
        if (r?.type === 'record') group.push(r);
        i++;
      }
      out += recordTable(group);
      continue;
    } else {
      out += `${objectToString(o)}\n`;
    }
    i++;
  }
  return out;
};

const m_name = (mode: 'text' | 'count'): string =>
  mode === 'count' ? 'Microsoft.PowerShell.Commands.GenericMeasureInfo' : 'Microsoft.PowerShell.Commands.TextMeasureInfo';

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
      return o.path === '' ? o.line : `${o.path}:${o.lineNumber}:${o.line}`;
    case 'measure':
      return m_name(o.mode);
    case 'record':
      return '@{' + o.props.map(([k, v]) => `${k}=${v === null ? '' : objectToString(v)}`).join('; ') + '}';
    case 'scriptblock':
      return o.text;
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
      if (p === 'lines') return { type: 'number', value: o.lines };
      if (p === 'words') return { type: 'number', value: o.words };
      if (p === 'characters') return { type: 'number', value: o.chars };
      if (p === 'count') return { type: 'number', value: o.mode === 'count' ? o.count : o.lines };
      return null;
    case 'record': {
      const hit = o.props.find(([k]) => k.toLowerCase() === p);
      return hit === undefined ? null : hit[1];
    }
    case 'scriptblock':
      return null;
    case 'number':
      return null;
  }
};
