import type { Expression } from '../lib/director';

/**
 * The cast's expression sheet. Pure data so it is deterministic, unit-testable,
 * and renders instantly (no images, no fonts): Character.tsx turns it into SVG.
 * Coordinates are local: brows are drawn around y=0 at the brow line, mouths
 * around (0,0) at the mouth line, and each character places them.
 */
export type Eyes = 'open' | 'wide' | 'happy' | 'lidded';
export type Pose = 'rest' | 'gesture' | 'cheer' | 'crossed' | 'hands-up' | 'chin';
export type Extra = 'none' | 'sparkle' | 'sweat' | 'shock' | 'thought';

export interface Face {
  eyes: Eyes;
  /** Where the pupils look (px). */
  gaze: [number, number];
  browL: string; browR: string; browDy: number;
  mouth: string; mouthOpen: boolean; teeth?: boolean;
  pose: Pose;
  extra: Extra;
  /** Flux's waveform crest: five bar heights, left to right. */
  crest: [number, number, number, number, number];
}

export const FACES: Record<Expression, Face> = {
  neutral: { eyes: 'open', gaze: [0, 0], browL: 'M-24,0 q9,-4 18,0', browR: 'M24,0 q-9,-4 -18,0', browDy: 0, mouth: 'M-12,0 q12,5 24,0', mouthOpen: false, pose: 'rest', extra: 'none', crest: [14, 24, 32, 24, 14] },
  talking: { eyes: 'open', gaze: [0, 0], browL: 'M-24,0 q9,-4 18,0', browR: 'M24,0 q-9,-4 -18,0', browDy: -2, mouth: 'M-11,-3 a11,8 0 1,0 22,0 a11,8 0 1,0 -22,0', mouthOpen: true, pose: 'gesture', extra: 'none', crest: [18, 30, 38, 30, 18] },
  happy: { eyes: 'happy', gaze: [0, 0], browL: 'M-24,0 q9,-8 18,-2', browR: 'M24,0 q-9,-8 -18,-2', browDy: -4, mouth: 'M-16,-4 Q0,20 16,-4 Z', mouthOpen: true, teeth: true, pose: 'cheer', extra: 'sparkle', crest: [18, 30, 40, 30, 18] },
  upset: { eyes: 'lidded', gaze: [0, 1], browL: 'M-24,-5 l18,7', browR: 'M24,-5 l-18,7', browDy: 0, mouth: 'M-12,4 q12,-12 24,0', mouthOpen: false, pose: 'crossed', extra: 'sweat', crest: [8, 12, 16, 12, 8] },
  surprised: { eyes: 'wide', gaze: [0, 0], browL: 'M-24,0 q9,-10 18,-4', browR: 'M24,0 q-9,-10 -18,-4', browDy: -8, mouth: 'M-7,0 a7,8 0 1,0 14,0 a7,8 0 1,0 -14,0', mouthOpen: true, pose: 'hands-up', extra: 'shock', crest: [22, 34, 44, 34, 22] },
  thinking: { eyes: 'open', gaze: [3, -4], browL: 'M-24,0 h18', browR: 'M24,-7 q-9,-6 -18,0', browDy: 0, mouth: 'M-8,2 q8,-3 14,-6', mouthOpen: false, pose: 'chin', extra: 'thought', crest: [10, 20, 28, 20, 10] },
};

export interface Arm { path: string; hand: [number, number] }
/**
 * Arm polylines from the shoulders (±40, 0) with the hand at the end. Both
 * characters share the poses; the caller translates to its shoulder line.
 * The x>0 arm faces the middle of the strip once the agent is mirrored.
 */
const ARMS: Record<Pose, Arm[]> = {
  rest: [{ path: 'M-40,0 L-50,34', hand: [-51, 40] }, { path: 'M40,0 L50,34', hand: [51, 40] }],
  gesture: [{ path: 'M-40,0 L-50,34', hand: [-51, 40] }, { path: 'M40,0 L60,12 L56,-18', hand: [54, -26] }],
  cheer: [{ path: 'M-40,0 L-60,-28', hand: [-64, -36] }, { path: 'M40,0 L60,-28', hand: [64, -36] }],
  crossed: [{ path: 'M-40,0 L-22,24 L24,18', hand: [30, 16] }, { path: 'M40,0 L22,24 L-24,18', hand: [-30, 16] }],
  'hands-up': [{ path: 'M-40,0 L-58,-14 L-48,-30', hand: [-46, -38] }, { path: 'M40,0 L58,-14 L48,-30', hand: [46, -38] }],
  chin: [{ path: 'M-40,0 L-30,24 L14,20', hand: [20, 18] }, { path: 'M40,0 L48,-6 L24,-22', hand: [18, -26] }],
};
export const arms = (pose: Pose): Arm[] => ARMS[pose];

export const EXPRESSIONS = Object.keys(FACES) as Expression[];

/** Half the horizontal footprint of a character (widest pose: cheering hands, thought bubbles). Layout derives from this. */
export const CHAR_HALF_W = 80;
/** Half the vertical footprint around the head origin (hoodie hem below, thought bubble above). */
export const CHAR_HALF_H = 100;
