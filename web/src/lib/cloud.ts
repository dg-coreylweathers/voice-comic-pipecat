import { moodOf } from './director.ts';
import type { ThemeTerm } from './types';

export interface Placed { term: string; count: number; x: number; y: number; size: number; w: number; h: number; color: string }

/** Deterministic word cloud: biggest first, each word walks a spiral from the centre until its box is clear. No randomness, so the booth screen and a PNG export agree. */
export function layoutCloud(terms: ThemeTerm[], width: number, height: number, { min = 14, max = 64 } = {}): Placed[] {
  const sorted = [...terms].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  if (!sorted.length) return [];
  const top = sorted[0].count, low = sorted[sorted.length - 1].count;
  const scale = (c: number) => (top === low ? (min + max) / 2 : min + ((Math.sqrt(c) - Math.sqrt(low)) / (Math.sqrt(top) - Math.sqrt(low))) * (max - min));
  const placed: Placed[] = [];
  for (const t of sorted) {
    const size = Math.round(scale(t.count));
    const w = t.term.length * size * 0.58 + 8, h = size * 1.1;
    let spot: { x: number; y: number } | null = null;
    const reach = Math.hypot(width, height) / 2;
    for (let i = 0; i < 4000 && !spot; i++) {
      const a = i * 0.35, r = 2.2 * i * 0.35;
      if (r > reach) break; // everything further out is off the canvas
      const x = width / 2 + r * Math.cos(a) * 1.25, y = height / 2 + r * Math.sin(a);
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      if (box.x < 4 || box.y < 4 || box.x + w > width - 4 || box.y + h > height - 4) continue;
      if (placed.some((p) => overlaps(box, { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h }))) continue;
      spot = { x, y };
    }
    if (!spot) continue; // no room left: the smallest terms drop off
    placed.push({ term: t.term, count: t.count, x: spot.x, y: spot.y, size, w, h, color: tone(t.sentiment) });
  }
  return placed;
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Sentiment colours on the cream strip background. */
const MOOD_COLOR = { happy: '#0a9a62', upset: '#3b5bdb' } as const;
export const tone = (s: number) => { const m = moodOf(s); return m ? MOOD_COLOR[m] : '#111'; };
