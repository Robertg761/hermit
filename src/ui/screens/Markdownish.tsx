import { Fragment } from 'react';

/** Renders `code` and *emphasis* in lesson text. Nothing else, so content stays plain. */
export function Markdownish({ text }: { readonly text: string }) {
  const parts = text.split(/(`[^`]+`|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 1) return <em key={i}>{p.slice(1, -1)}</em>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
