import type { OS } from '../../domain/types';

type Part = { readonly text: string; readonly label?: string };

/** Split a prompt into labelled parts, so the first lesson shows a real prompt instead of describing one. */
export const promptParts = (os: OS, prompt: string): readonly Part[] | null => {
  const p = prompt.trimEnd();
  if (os === 'windows') {
    const m = /^(PS) (.+)(>)$/.exec(p);
    if (m === null) return null;
    return [{ text: m[1] ?? '', label: 'PowerShell' }, { text: ' ' }, { text: m[2] ?? '', label: 'where you are' }, { text: m[3] ?? '', label: 'your turn' }];
  }
  const m = os === 'linux' ? /^([^@]+)(@)([^:]+)(:)(\S+)(\$)$/.exec(p) : /^([^@]+)(@)(\S+)( )(\S+) (%)$/.exec(p);
  if (m === null) return null;
  return [
    { text: m[1] ?? '', label: 'who you are' },
    { text: m[2] ?? '' },
    { text: m[3] ?? '', label: 'which computer' },
    { text: m[4] ?? '' },
    { text: m[5] ?? '', label: 'where you are' },
    { text: os === 'mac' ? ` ${m[6] ?? ''}` : (m[6] ?? ''), label: 'your turn' },
  ];
};

export function PromptAnatomy({ os, prompt }: { os: OS; prompt: string }) {
  const parts = promptParts(os, prompt);
  if (parts === null) return null;
  return (
    <div className={`predict-screen os-screen-${os} anatomy`} aria-label={`The prompt: ${prompt}`}>
      <div className="anatomy-row">
        {parts.map((part, i) => (
          <span key={i} className={`anatomy-part${part.label !== undefined ? ' has-label' : ''}`}>
            <span className="anatomy-text">{part.text.replace(/ /g, '\u00a0')}</span>
            {part.label !== undefined && <span className="anatomy-label">{part.label}</span>}
          </span>
        ))}
        <span className="anatomy-cursor" aria-hidden="true" />
      </div>
    </div>
  );
}
