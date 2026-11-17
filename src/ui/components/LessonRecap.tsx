import type { Lesson } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { Markdownish } from '../screens/Markdownish';

/**
 * After a lesson: what it taught, and how to try it on the learner's own computer.
 * The course is only worth something if it carries over to a real terminal.
 */

const OPEN_TERMINAL: Record<OS, string> = {
  linux: 'Press **Ctrl+Alt+T**, or search your apps for *Terminal*.',
  mac: 'Press **Cmd+Space**, type *Terminal*, then press Return.',
  windows: 'Press the **Windows key**, type *Terminal*, then press Enter. It opens PowerShell.',
};

/** Commands that change or stop things stay in the simulator; these suggestions are look-only. */
const RISKY = /^(rm|rmdir|mv|cp|kill|pkill|killall|chmod|sudo|touch|mkdir|echo|Remove-Item|Move-Item|Copy-Item|Rename-Item|New-Item|Stop-Process|Set-ExecutionPolicy|Start-Process|Set-Content|Add-Content|Out-File)\b|>/i;

export type RecapItem = { readonly title: string; readonly example?: string };

export const recapItems = (lesson: Lesson, os: OS): readonly RecapItem[] =>
  lesson.challenges
    .filter((c) => c.type === 'learn' && c.card !== undefined)
    .map((c) => {
      const card = c.card?.[os];
      // The errors card's example is a deliberate typo, not something to try.
      const example = (c.teaches ?? []).includes('errors') ? undefined : card?.example;
      return { title: card?.title ?? '', ...(example !== undefined ? { example } : {}) };
    })
    .filter((item) => item.title !== '');

export function LessonRecap({ lesson, os }: { readonly lesson: Lesson; readonly os: OS }) {
  const items = recapItems(lesson, os);
  const safe = items.map((i) => i.example).filter((e): e is string => e !== undefined && !RISKY.test(e.trim()));
  if (items.length === 0) return null;
  return (
    <section className="recap" aria-label="What you learned">
      <div className="recap-card">
        <h2>You learned</h2>
        <ul>
          {items.map((item) => (
            <li key={item.title}>
              <Markdownish text={item.title} />
            </li>
          ))}
        </ul>
      </div>
      <div className="recap-card recap-real">
        <h2>Try it on your computer</h2>
        <p>
          <Markdownish text={OPEN_TERMINAL[os]} />
        </p>
        {safe.length > 0 ? (
          <p>
            Then type{' '}
            {safe.map((cmd, i) => (
              <span key={cmd}>
                {i > 0 && (i === safe.length - 1 ? ' and ' : ', ')}
                <code>{cmd}</code>
              </span>
            ))}
            . Your files have different names from Herme's, so swap in your own.
          </p>
        ) : (
          <p>Look around with the commands from this lesson. Anything that deletes, moves or stops things works for real there, so read it twice before you press Enter.</p>
        )}
      </div>
    </section>
  );
}
