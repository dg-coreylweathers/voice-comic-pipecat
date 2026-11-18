import { memo } from 'react';
import { Bubble } from './Bubble';
import { Character } from './Character';
import { PANEL_H, PANEL_W, pillWidth, type Side } from './layout';
import { CHAR_HALF_W } from './cast';
import { COMIC_FONT, LabelPill, TITLE_FONT, Tag, labelWidth, tagWidth } from './Tag';
import { direct, labels, type LabelTone } from '../lib/director';
import { findExperience } from '../lib/experience';
import { findMode, speakerBadge } from '../lib/modes';
import { panelCost, panelTag } from '../lib/pricing';
import { useStore } from '../lib/store';
import type { Catalog, ExperienceKey, Panel as PanelT } from '../lib/types';

interface Props { panel: PanelT; index: number; x: number; y: number; side: Side; layout: ExperienceKey; agentSpeaking: boolean; showTags: boolean; prevModel?: string; prevSpeaker?: number }

const LABEL_STYLE: Record<LabelTone, { fill: string; color: string }> = { ok: { fill: '#13ef95', color: '#062015' }, alert: { fill: '#ff5c5c', color: '#fff' }, info: { fill: '#7aa2f7', color: '#0b1020' }, mood: { fill: '#ffd166', color: '#3a2a00' } };
/** Bubble edge on the character's side: the character column plus a gap. */
const BUBBLE_INSET = CHAR_HALF_W * 2 - 14;

/** TTS family for the badge under Flux; catalog first, model-id prefix when the catalog does not know the id. */
const familyCache = new Map<string, string>();
function speakFamily(catalog: Catalog | null, model: string) {
  const hit = familyCache.get(model);
  if (hit) return hit;
  const fam = catalog?.speak.find((m) => m.model === model)?.family ?? (model.startsWith('aura') ? 'aura' : 'flux');
  if (catalog) familyCache.set(model, fam);
  return fam;
}

export const Panel = memo(function Panel({ panel, index, x, y, side, layout, agentSpeaking, showTags, prevModel, prevSpeaker }: Props) {
  const catalog = useStore((s) => s.catalog);
  const cost = catalog && panel.final ? panelCost(panel, catalog) : null;
  const d = direct(panel, agentSpeaking);
  const isAgent = panel.role === 'agent';
  const right = side === 'right'; // the character stands on the outer edge and faces the middle of the strip
  const tags = labels(panel, prevModel, agentSpeaking, prevSpeaker);
  const modelTag = `${panel.model}${panel.version === 'v2' ? '' : ' (v1)'}`;
  const badges = layout === 'duet' ? findExperience(catalog, 'duet')?.badges : panel.mode ? findMode(catalog, panel.mode)?.badges : undefined;
  const badge = isAgent ? speakFamily(catalog, panel.model).toUpperCase() : speakerBadge(badges, panel);
  const variant = !isAgent && (panel.speaker ?? 0) > 0 ? 1 : 0;
  // X-ray pills along the top edge: model, latency, non-English languages; the cost tag sits top-right.
  const pills: { text: string; color: string }[] = [{ text: modelTag, color: d.accent }];
  if (panel.latencyMs != null) pills.push({ text: `${(panel.latencyMs / 1000).toFixed(2)}s`, color: '#fff' });
  if (panel.langs?.some((l) => l !== 'en')) pills.push({ text: panel.langs.join(' '), color: '#fff' });
  const pillX = (i: number) => 8 + pills.slice(0, i).reduce((s, p) => s + tagWidth(p.text) + 4, 0);
  const captionW = d.caption ? Math.min(200, pillWidth(d.caption, 12, 16)) : 0;
  const reveal = isAgent ? Math.min(panel.text.length, panel.spokenChars ?? 0) : undefined;

  return (
    <g transform={`translate(${x} ${y})`} className={`panel panel--${panel.role}${panel.final ? '' : ' panel--live'}`}>
      <rect width={PANEL_W} height={PANEL_H} fill={d.bg} stroke="#111" strokeWidth="4" />
      {/* halftone-ish corner texture */}
      <circle cx={right ? 40 : PANEL_W - 40} cy={PANEL_H - 60} r="70" fill={d.accent} opacity="0.12" />
      {/* The bubble leaves the character's column clear so long turns never cover the face. */}
      <Bubble text={panel.text || '…'} x={right ? 16 : BUBBLE_INSET} y={16} w={PANEL_W - 16 - BUBBLE_INSET} maxLines={5} style={d.bubble} tailTo={right ? 'right' : 'left'} revealChars={reveal} strikeFrom={panel.interruptedAt} live={!panel.final && !isAgent} fontFamily={COMIC_FONT} />
      <Character kind={isAgent ? 'agent' : 'user'} expression={d.expression} x={right ? PANEL_W - CHAR_HALF_W : CHAR_HALF_W} y={PANEL_H - 100} flip={right} accent={d.accent} badge={badge} variant={variant} />
      {d.sfx && (
        // Bursts sit in the open corner away from the character, above the caption. The rotation lives on the group so the .sfx pop animation (a CSS transform) does not compose with it.
        <g transform={`rotate(${right ? -12 : 12} ${right ? 70 : PANEL_W - 70} ${PANEL_H - 62})`}>
          <text x={right ? 70 : PANEL_W - 70} y={PANEL_H - 62} textAnchor="middle" fontFamily={TITLE_FONT} fontSize={d.sfx.length > 4 ? 22 : 40} fontWeight="900" fill={panel.redacted ? '#c0392b' : '#ffd400'} stroke="#111" strokeWidth="2.5" paintOrder="stroke" className="sfx">{d.sfx}</text>
        </g>
      )}
      {d.caption && (
        <g transform={`translate(${right ? 12 : PANEL_W - 12 - captionW} ${PANEL_H - 34})`}>
          <rect width={captionW} height="24" fill="#fff3b0" stroke="#111" strokeWidth="2" />
          <text x="8" y="17" fontSize="12" fontFamily={COMIC_FONT} fill="#111">{d.caption.slice(0, 26)}</text>
        </g>
      )}
      {tags.map((l, i) => {
        const w = labelWidth(l.text), lx = right ? PANEL_W - CHAR_HALF_W * 2 + 10 - w : CHAR_HALF_W * 2 - 10, ly = PANEL_H - 36 - (tags.length - 1 - i) * 28; // most notable label sits highest, nearest the face
        return <LabelPill key={l.text} x={lx} y={ly} text={l.text} fill={LABEL_STYLE[l.tone].fill} color={LABEL_STYLE[l.tone].color} className={`label label--${l.tone}`} />;
      })}
      {showTags && pills.map((t, i) => <Tag key={t.text} x={pillX(i)} y={8} text={t.text} color={t.color} />)}
      {showTags && cost && <Tag x={PANEL_W - 8 - tagWidth(panelTag(cost))} y={8} text={panelTag(cost)} color="#ffd166" />}
      <text x={PANEL_W - 10} y={PANEL_H - 8} textAnchor="end" fontSize="11" fontFamily={COMIC_FONT} fill="#111" opacity="0.6">{index + 1}</text>
    </g>
  );
});
