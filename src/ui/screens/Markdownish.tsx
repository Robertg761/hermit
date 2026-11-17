import { Fragment } from 'react';

/** Renders `code`, **bold** and *emphasis* in lesson text. Nothing else, so content stays plain. */
export function Markdownish({ text }: { readonly text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 1) {
          // Short commands like `Select-String` shouldn't break at the hyphen on a phone.
          const code = p.slice(1, -1);
          return <code key={i}>{code.length <= 24 ? code.replace(/-/g, '\u2011') : code}</code>;
        }
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 1) return <em key={i}>{p.slice(1, -1)}</em>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
