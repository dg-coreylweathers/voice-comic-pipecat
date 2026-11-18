import { fitText } from './layout';
import type { BubbleStyle } from '../lib/director';
import { REDACTION_RE } from '../lib/director';

interface Props {
  text: string; x: number; y: number; w: number; maxLines: number; style: BubbleStyle;
  tailTo: 'left' | 'right'; revealChars?: number; strikeFrom?: number; live?: boolean; fontFamily: string;
}

/** Speech bubble with wrapped SVG text, progressive reveal, strikethrough, and censor bars. */
export function Bubble({ text, x, y, w, maxLines, style, tailTo, revealChars, strikeFrom, live, fontFamily }: Props) {
  const shown = text.replace(REDACTION_RE, (m) => '█'.repeat(Math.min(12, Math.max(5, Math.round(m.length * 0.6)))));
  const { lines, fontSize, lineHeight } = fitText(shown || ' ', w - 28, maxLines);
  const h = Math.max(46, lines.length * lineHeight + 24);
  const reveal = revealChars ?? shown.length;
  const strike = strikeFrom ?? Infinity;
  const tailX = tailTo === 'left' ? x + 44 : x + w - 44;
  const tail = `M${tailX - 12},${y + h - 1} L${tailX + (tailTo === 'left' ? -34 : 34)},${y + h + 22} L${tailX + 12},${y + h - 1}`;
  const shape = style === 'shout' ? spiky(x, y, w, h) : null;
  return (
    <g className={`bubble bubble--${style}`}>
      {shape ? <path d={shape} fill="#fff" stroke="#111" strokeWidth="3" strokeLinejoin="round" /> : <rect x={x} y={y} width={w} height={h} rx={style === 'calm' ? 26 : 12} fill="#fff" stroke="#111" strokeWidth="3" />}
      <path d={tail} fill="#fff" stroke="#111" strokeWidth="3" strokeLinejoin="round" />
      {!shape && <rect x={x + 2} y={y + h - 6} width={w - 4} height="8" fill="#fff" />}
      {lines.map((ln, i) => {
        const ly = y + 16 + fontSize + i * lineHeight;
        const segs = split(ln.text, ln.start, reveal, strike);
        return (
          <text key={i} x={x + 14} y={ly} fontSize={fontSize} fontFamily={fontFamily} fontWeight={style === 'shout' ? 800 : 600} fill="#111">
            {segs.map((s, j) => (
              <tspan key={j} fill={s.kind === 'struck' ? '#a33' : s.kind === 'hidden' ? 'transparent' : '#111'} textDecoration={s.kind === 'struck' ? 'line-through' : undefined} opacity={s.kind === 'struck' ? 0.7 : 1}>{s.text}</tspan>
            ))}
            {live && i === lines.length - 1 && <tspan className="cursor" fill="#111">▌</tspan>}
          </text>
        );
      })}
    </g>
  );
}

function split(text: string, start: number, reveal: number, strike: number) {
  const out: { text: string; kind: 'shown' | 'struck' | 'hidden' }[] = [];
  let i = 0;
  while (i < text.length) {
    const abs = start + i;
    const kind = abs >= strike ? 'struck' : abs < reveal ? 'shown' : 'hidden';
    let j = i + 1;
    while (j < text.length) { const a = start + j; const k = a >= strike ? 'struck' : a < reveal ? 'shown' : 'hidden'; if (k !== kind) break; j++; }
    out.push({ text: text.slice(i, j), kind });
    i = j;
  }
  return out;
}

function spiky(x: number, y: number, w: number, h: number) {
  const pts: string[] = [];
  const n = 22, cx = x + w / 2, cy = y + h / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 ? 1.0 : 1.14;
    const px = cx + Math.cos(a) * (w / 2) * r, py = cy + Math.sin(a) * (h / 2 + 6) * r;
    pts.push(`${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return pts.join(' ') + 'Z';
}
