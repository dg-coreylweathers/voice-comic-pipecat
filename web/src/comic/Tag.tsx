import { pillWidth } from './layout';

export const COMIC_FONT = '"Chalkboard SE", "Comic Sans MS", "Segoe Print", "Trebuchet MS", sans-serif';
export const MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace';
export const TITLE_FONT = 'Impact, "Arial Black", sans-serif';
/** The strip's paper colour, shared by every exportable SVG. */
export const PAPER = '#fbf7ef';

export const labelWidth = (t: string) => pillWidth(t, 13, 18);
/** Rounded comic-font pill used for micro-labels and strip dividers. */
export function LabelPill({ x, y, text, fill, color, className }: { x: number; y: number; text: string; fill: string; color: string; className?: string }) {
  const w = labelWidth(text);
  return (
    <g transform={`translate(${x} ${y})`} className={className}>
      <rect width={w} height="24" rx="12" fill={fill} stroke="#111" strokeWidth="2" />
      <text x={w / 2} y="17" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily={COMIC_FONT} fill={color}>{text}</text>
    </g>
  );
}

export const tagWidth = (text: string) => pillWidth(text, 10, 12);

interface Props { x: number; y: number; text: string; color?: string; fill?: string; opacity?: number }
/** Small dark monospace pill used for model, latency, language and cost tags. */
export function Tag({ x, y, text, color = '#fff', fill = '#111', opacity = 0.85 }: Props) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={tagWidth(text)} height="16" rx="8" fill={fill} opacity={opacity} />
      <text x="6" y="12" fontSize="10" fill={color} fontFamily={MONO_FONT}>{text}</text>
    </g>
  );
}
