import { mix, type Expression } from '../lib/director';
import { FACES, arms, type Eyes, type Extra, type Face, type Pose } from './cast';
import { MONO_FONT } from './Tag';

interface Props { kind: 'user' | 'agent'; expression: Expression; x: number; y: number; flip?: boolean; accent: string; badge?: string; /** Visitor look: 0 = glasses and curls, 1 = beanie (second diarized speaker). */ variant?: 0 | 1 }

const INK = '#111';
const SKIN = '#f6d5b8';
const HAIR = '#2b1d3a';
const SKIN_2 = '#c68642';
const HAIR_2 = '#1f2937';
const HAIR_BACK = [[-30, -20, 15], [-16, -36, 16], [0, -42, 17], [16, -36, 16], [30, -20, 15], [-38, -2, 10], [38, -2, 10]];
const FRINGE = [[-20, -40, 9], [-2, -44, 10], [14, -41, 9]];
const FRECKLES = [[-26, 6], [-22, 10], [-29, 12], [26, 6], [22, 10], [29, 12]];

/**
 * The cast. The visitor is a curly-haired developer in a hoodie with round
 * glasses and a conference lanyard. Flux, the Deepgram side, is a green sound
 * wave that grew a face: its crest is a waveform that jumps when it talks.
 * Everything is plain SVG so panels draw instantly and export to PNG verbatim.
 */
export function Character({ kind, expression, x, y, flip, accent, badge, variant = 0 }: Props) {
  const f = FACES[expression];
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`} className={`char char--${kind} expr--${expression}`}>
      {kind === 'user' ? <Visitor f={f} accent={accent} variant={variant} /> : <Flux f={f} accent={accent} />}
      {badge && <g transform={`scale(${flip ? -1 : 1} 1)`}><rect x="-34" y="78" width="68" height="16" rx="8" fill={INK} /><text x="0" y="90" textAnchor="middle" fontSize="10" fill={accent} fontFamily={MONO_FONT}>{badge}</text></g>}
    </g>
  );
}

function Visitor({ f, accent, variant }: { f: Face; accent: string; variant: 0 | 1 }) {
  const hood = mix(accent, '#000000', 0.25);
  const skin = variant ? SKIN_2 : SKIN;
  return (
    <>
      {/* hood behind the head, hoodie body, lanyard */}
      <path d="M-46,44 Q-50,-6 0,-12 Q50,-6 46,44 Z" fill={hood} stroke={INK} strokeWidth="3" />
      <path d="M-50,96 V70 Q-50,38 -18,34 L0,46 L18,34 Q50,38 50,70 V96 Z" fill={accent} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M-14,40 L-8,66 M14,40 L8,66" stroke={INK} strokeWidth="2.5" fill="none" />
      <rect x="-16" y="64" width="32" height="22" rx="3" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <rect x="-16" y="64" width="32" height="7" fill={hood} />
      <rect x="-10" y="75" width="20" height="2.5" fill="#999" /><rect x="-10" y="80" width="12" height="2.5" fill="#bbb" />
      {/* hair back, face, fringe (variant 1: short hair under a beanie, no glasses) */}
      {variant === 0 && HAIR_BACK.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={HAIR} stroke={INK} strokeWidth="3" />)}
      {variant === 1 && <path d="M-36,-6 Q-36,-40 0,-40 Q36,-40 36,-6 Z" fill={HAIR_2} stroke={INK} strokeWidth="3" />}
      <circle cx="0" cy="0" r="34" fill={skin} stroke={INK} strokeWidth="3" />
      {variant === 0 && FRINGE.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={HAIR} stroke={INK} strokeWidth="3" />)}
      {variant === 1 && <>
        <path d="M-38,-14 Q-38,-50 0,-50 Q38,-50 38,-14 Q20,-24 0,-22 Q-20,-24 -38,-14 Z" fill={mix(accent, '#ffffff', 0.15)} stroke={INK} strokeWidth="3" />
        <rect x="-38" y="-22" width="76" height="12" rx="5" fill={hood} stroke={INK} strokeWidth="3" />
        <circle cx="0" cy="-52" r="7" fill={hood} stroke={INK} strokeWidth="3" />
        <circle cx="34" cy="8" r="3" fill="#ffd166" stroke={INK} strokeWidth="1.5" />
      </>}
      {variant === 0 && FRECKLES.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.6" fill="#d9a07a" />)}
      <EyesG eyes={f.eyes} gaze={f.gaze} cx={14} cy={-8} rx={7} ry={8} lid={skin} />
      {variant === 0 && <>
        <g fill="#fff" fillOpacity="0.18" stroke={INK} strokeWidth="3"><circle cx="-14" cy="-8" r="15" /><circle cx="14" cy="-8" r="15" /></g>
        <path d="M-1,-10 h2 M-29,-9 l-8,-3 M29,-9 l8,-3" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>}
      <Brows f={f} y={variant ? -22 : -26} lift={0.5} />
      <Mouth f={f} y={14} />
      <Arms pose={f.pose} shoulderY={48} sleeve={accent} skin={skin} />
      <ExtraG extra={f.extra} />
    </>
  );
}

function Flux({ f, accent }: { f: Face; accent: string }) {
  const dark = mix(accent, '#000000', 0.45);
  return (
    <>
      <ellipse cx="0" cy="82" rx="30" ry="5" fill={INK} opacity="0.15" />
      {/* waveform crest */}
      <g className="crest">{f.crest.map((h, i) => { const mid = (f.crest.length - 1) / 2; return <rect key={i} x={(i - mid) * 12 - 4} y={-44 - h} width="8" height={h + 6} rx="4" fill={dark} stroke={INK} strokeWidth="2.5" style={{ animationDelay: `${-Math.abs(i - mid) * 0.17}s` }} />; })}</g>
      {/* body */}
      <path d="M0,-48 C34,-48 46,-20 46,14 C46,50 30,72 0,72 C-30,72 -46,50 -46,14 C-46,-20 -34,-48 0,-48 Z" fill={accent} stroke={INK} strokeWidth="3" />
      <path d="M-30,-22 C-26,-36 -14,-42 -4,-42 C-14,-36 -22,-30 -26,-16 Z" fill="#fff" opacity="0.4" />
      <path d="M-40,30 C-38,56 -20,68 0,68 C20,68 38,56 40,30 C34,52 18,60 0,60 C-18,60 -34,52 -40,30 Z" fill={dark} opacity="0.35" />
      <ellipse cx="-28" cy="8" rx="6" ry="4" fill="#ff9fb0" opacity="0.85" /><ellipse cx="28" cy="8" rx="6" ry="4" fill="#ff9fb0" opacity="0.85" />
      <Arms pose={f.pose} shoulderY={22} sleeve={accent} skin={accent} />
      <EyesG eyes={f.eyes} gaze={f.gaze} cx={16} cy={-10} rx={f.eyes === 'wide' ? 13 : 11} ry={f.eyes === 'wide' ? 15 : 13} lid={accent} big />
      <Brows f={f} y={-32} />
      <Mouth f={f} y={24} />
      <ExtraG extra={f.extra} />
    </>
  );
}

function Arms({ pose, shoulderY, sleeve, skin }: { pose: Pose; shoulderY: number; sleeve: string; skin: string }) {
  return (
    <g transform={`translate(0 ${shoulderY})`}><g className="arms">
      {arms(pose).map((a, i) => (
        <g key={i}>
          <path d={a.path} fill="none" stroke={INK} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
          <path d={a.path} fill="none" stroke={sleeve} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={a.hand[0]} cy={a.hand[1]} r="9" fill={skin} stroke={INK} strokeWidth="3" />
        </g>
      ))}
    </g></g>
  );
}

function EyesG({ eyes, gaze, cx, cy, rx, ry, lid, big }: { eyes: Eyes; gaze: [number, number]; cx: number; cy: number; rx: number; ry: number; lid: string; big?: boolean }) {
  if (eyes === 'happy') {
    return <g stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round"><path d={`M${-cx - rx},${cy + 2} Q${-cx},${cy - ry} ${-cx + rx},${cy + 2}`} /><path d={`M${cx - rx},${cy + 2} Q${cx},${cy - ry} ${cx + rx},${cy + 2}`} /></g>;
  }
  const pr = (eyes === 'wide' ? 0.62 : 0.5) * rx;
  return (
    <g className="eyes">
      {[-cx, cx].map((ex) => (
        <g key={ex}>
          <ellipse cx={ex} cy={cy} rx={rx} ry={ry} fill="#fff" stroke={INK} strokeWidth={big ? 2.5 : 2} />
          <circle cx={ex + gaze[0]} cy={cy + gaze[1]} r={pr} fill={INK} />
          <circle cx={ex + gaze[0] - pr * 0.35} cy={cy + gaze[1] - pr * 0.4} r={pr * 0.3} fill="#fff" />
          {eyes === 'lidded' && <path d={`M${ex - rx - 1},${cy - 1} A${rx + 1},${ry + 1} 0 0 1 ${ex + rx + 1},${cy - 1} Z`} fill={lid} stroke={INK} strokeWidth="2" />}
        </g>
      ))}
    </g>
  );
}

function Brows({ f, y, lift = 1 }: { f: Face; y: number; lift?: number }) {
  return <g transform={`translate(0 ${y + f.browDy * lift})`} stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round"><path d={f.browL} /><path d={f.browR} /></g>;
}

function Mouth({ f, y }: { f: Face; y: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path d={f.mouth} className="mouth" stroke={INK} strokeWidth="3" fill={f.mouthOpen ? '#7a2a2a' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
      {f.teeth && <path d="M-13,-3 h26 v3 q-13,4 -26,0 z" fill="#fff" />}
    </g>
  );
}

function ExtraG({ extra }: { extra: Extra }) {
  switch (extra) {
    case 'sparkle': return <g fill="#ffd400" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" className="sparkle"><path d={SPARKLE_BIG} /><path d={SPARKLE_SMALL} /></g>;
    case 'sweat': return <path d="M40,-34 q8,10 0,16 q-8,-6 0,-16 z" fill="#7aa2f7" stroke={INK} strokeWidth="2" />;
    case 'shock': return <g stroke={INK} strokeWidth="3" strokeLinecap="round"><path d="M42,-56 l6,-12 M52,-46 l12,-6 M32,-62 l1,-13" /></g>;
    case 'thought': return <g fill="#fff" stroke={INK} strokeWidth="2.5"><circle cx="46" cy="-44" r="4" /><circle cx="56" cy="-56" r="6" /><circle cx="70" cy="-72" r="8" /></g>;
    default: return null;
  }
}

/** Four-point sparkles near the top-right of the head (pre-baked; they never move). */
function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.4 : r; pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`); }
  return `M${pts.join(' L')} Z`;
}
const SPARKLE_BIG = star(48, -50, 8);
const SPARKLE_SMALL = star(60, -30, 5);
