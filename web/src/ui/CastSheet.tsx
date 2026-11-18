import { Character } from '../comic/Character';
import { CHAR_HALF_H, CHAR_HALF_W, EXPRESSIONS } from '../comic/cast';
import { ACCENT } from '../lib/director';
import { COMIC_FONT } from '../comic/Tag';
import { PageBar } from './PageBar';

/** Every character in every expression, for visual QA and the presenter's cheat sheet. */
export function CastSheet({ onBack }: { onBack: () => void }) {
  const cell = CHAR_HALF_W * 2, row = CHAR_HALF_H * 2 + 20, w = EXPRESSIONS.length * cell + 20, h = 2 * row + 40;
  return (
    <div className="app">
      <PageBar title="The cast"><span className="spacer" /><button className="primary" onClick={onBack}>Back to the strip</button></PageBar>
      <div className="strip-scroll"><div className="strip-wrap">
        <svg className="strip cast" viewBox={`0 0 ${w} ${h}`} width={w} height={h} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Character expression sheet">
          <rect width={w} height={h} fill="#fbf7ef" />
          {EXPRESSIONS.map((e, i) => (
            <g key={e}>
              <text x={10 + i * cell + cell / 2} y={24} textAnchor="middle" fontSize="14" fontWeight="700" fontFamily={COMIC_FONT} fill="#111">{e}</text>
              <Character kind="user" expression={e} x={10 + i * cell + cell / 2} y={40 + CHAR_HALF_H} accent={ACCENT.user} />
              <Character kind="agent" expression={e} x={10 + i * cell + cell / 2} y={40 + row + CHAR_HALF_H} flip accent={ACCENT.agent} badge="FLUX" />
            </g>
          ))}
        </svg>
      </div></div>
    </div>
  );
}
