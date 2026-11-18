import type { ExperienceKey, Panel } from '../lib/types';

export const PANEL_W = 540;
export const PANEL_H = 260;
export const GAP = 18;
/** One vertical column: the visitor's panels hang left, the robot's hang right, like a conversation. */
export const STRIP_W = 920;

export function stripSize(n: number) {
  return { width: STRIP_W, height: Math.max(1, n) * (PANEL_H + GAP) + GAP, rows: Math.max(1, n) };
}
export type Side = 'left' | 'right';
/** Which column a panel hangs in: the robot on the right; in a duet the second diarized speaker takes the robot's place. */
export function panelSide(p: Pick<Panel, 'role' | 'speaker'>, layout: ExperienceKey = 'agent'): Side {
  return p.role === 'agent' || (layout === 'duet' && (p.speaker ?? 0) > 0) ? 'right' : 'left';
}
export function panelOrigin(i: number, side: Side) {
  return { x: side === 'right' ? STRIP_W - GAP - PANEL_W : GAP, y: GAP + i * (PANEL_H + GAP) };
}

/** Width of a text pill: ~0.6em per glyph plus padding. One heuristic for tags, labels and captions. */
export const pillWidth = (text: string, fontSize: number, pad: number) => text.length * fontSize * 0.6 + pad;

export interface Line { text: string; start: number }
/** Greedy word wrap that keeps character offsets so reveal/strike indices survive. */
export function wrap(text: string, maxChars: number): Line[] {
  const lines: Line[] = [];
  let lineStart = 0, cursor = 0, current = '';
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) { current += token; cursor += token.length; continue; }
    if (current.trim().length && (current + token).trimEnd().length > maxChars) {
      lines.push({ text: current.trimEnd(), start: lineStart });
      lineStart = cursor; current = '';
    }
    let word = token;
    while (word.length > maxChars) { // hard-split words longer than a line
      lines.push({ text: word.slice(0, maxChars), start: cursor });
      word = word.slice(maxChars); cursor += maxChars; lineStart = cursor;
    }
    current += word; cursor += word.length;
  }
  if (current.trim().length) lines.push({ text: current.trimEnd(), start: lineStart });
  return lines.length ? lines : [{ text: '', start: 0 }];
}

/** Pick a font size so the text fits the bubble; returns lines + metrics. */
export function fitText(text: string, boxW: number, maxLines: number) {
  for (const fs of [20, 18, 16, 14, 12, 11]) {
    const maxChars = Math.floor(boxW / (fs * 0.52));
    const lines = wrap(text, maxChars);
    if (lines.length <= maxLines) return { lines, fontSize: fs, lineHeight: fs * 1.25 };
  }
  const fs = 10, maxChars = Math.floor(boxW / (fs * 0.52));
  const lines = wrap(text, maxChars).slice(0, maxLines);
  const last = lines[lines.length - 1];
  if (last) last.text = last.text.slice(0, Math.max(0, maxChars - 1)) + '…';
  return { lines, fontSize: fs, lineHeight: fs * 1.25 };
}
