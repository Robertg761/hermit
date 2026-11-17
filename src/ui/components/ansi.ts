/** A run of text with the SGR styles active at that point. */
export type AnsiSpan = { readonly text: string; readonly bold: boolean; readonly colour: string | null };

const COLOURS: Readonly<Record<string, string>> = {
  '30': 'black', '31': 'red', '32': 'green', '33': 'yellow', '34': 'blue', '35': 'magenta', '36': 'cyan', '37': 'white',
  '90': 'black', '91': 'red', '92': 'green', '93': 'yellow', '94': 'blue', '95': 'magenta', '96': 'cyan', '97': 'white',
};

const ESC = String.fromCharCode(27);
const SGR = (): RegExp => new RegExp(`${ESC}\\[([\\d;]*)m`, 'g');

/** Split terminal text with ANSI colour codes into styled spans, so static screens show colours, not escape codes. */
export const parseAnsi = (text: string): AnsiSpan[] => {
  const spans: AnsiSpan[] = [];
  let bold = false;
  let colour: string | null = null;
  const re = SGR();
  let last = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index), bold, colour });
    for (const code of (m[1] === '' ? '0' : (m[1] ?? '0')).split(';')) {
      if (code === '0' || code === '') {
        bold = false;
        colour = null;
      } else if (code === '1') bold = true;
      else if (code === '22') bold = false;
      else if (code === '39') colour = null;
      else colour = COLOURS[code] ?? colour;
    }
    last = re.lastIndex;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold, colour });
  return spans;
};

export const stripAnsi = (text: string): string => text.replace(SGR(), '');
