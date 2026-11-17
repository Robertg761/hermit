import type { Unit } from '../../domain/lessons/types';
import type { OS } from '../../domain/types';
import { Markdownish } from '../screens/Markdownish';

/**
 * A unit's cheat sheet, built from the Learn cards of the lessons finished so far,
 * so it grows as the learner does. Everything in it was taught on a card first.
 */
export function CheatSheet({ unit, os, completed }: { readonly unit: Unit; readonly os: OS; readonly completed: readonly string[] }) {
  const cards = unit.lessons
    .filter((l) => completed.includes(l.id))
    .flatMap((l) => l.challenges)
    .filter((c) => c.type === 'learn')
    .map((c) => {
      const card = c.card?.[os];
      // The errors card's example is a deliberate mistake: not something to copy.
      return card !== undefined && (c.teaches ?? []).includes('errors') ? { title: card.title, body: card.body } : card;
    })
    .filter((card) => card !== undefined);
  if (cards.length === 0) return null;
  return (
    <details className="cheat-sheet">
      <summary>Cheat sheet · {cards.length} {cards.length === 1 ? 'card' : 'cards'}</summary>
      <dl>
        {cards.map((card) => (
          <div key={card.title} className="cheat-row">
            <dt>{card.example !== undefined ? <code className="cheat-command">{card.example.replace(/-/g, '\u2011')}</code> : <Markdownish text={card.title} />}</dt>
            <dd>
              {card.example !== undefined && (
                <strong>
                  <Markdownish text={card.title} />
                  {/[.?!]$/.test(card.title) ? ' ' : '. '}
                </strong>
              )}
              <Markdownish text={card.body} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
