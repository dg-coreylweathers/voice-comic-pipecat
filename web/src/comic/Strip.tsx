import { forwardRef } from 'react';
import { Panel } from './Panel';
import { GAP, PANEL_H, PANEL_W, panelOrigin, panelSide, stripSize, type Side } from './layout';
import { LabelPill, PAPER, TITLE_FONT, labelWidth } from './Tag';
import type { ExperienceKey, Panel as PanelT } from '../lib/types';

interface Props {
  panels: PanelT[]; agentSpeaking?: boolean; showTags?: boolean; title?: string;
  /** Session-clock ms where the conversation was reset; drawn as a divider before the next panel. */
  resets?: number[];
  /** `agent`: visitors left, robot right. `duet`: speaker 1 left, speaker 2 right, no robot. */
  layout?: ExperienceKey;
}

/** The whole strip is one SVG so it can be exported as a PNG verbatim. */
export const Strip = forwardRef<SVGSVGElement, Props>(function Strip({ panels, agentSpeaking = false, showTags = true, title, resets = [], layout = 'agent' }, ref) {
  const { width, height } = stripSize(panels.length);
  const titleH = title ? 44 : 0;
  const sides = panels.map((p) => panelSide(p, layout));
  return (
    <svg ref={ref} className="strip" viewBox={`0 0 ${width} ${height + titleH}`} width={width} height={height + titleH} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title ?? 'Voice comic strip'}>
      <rect width={width} height={height + titleH} fill={PAPER} />
      {title && <text x={14} y={30} fontSize="24" fontWeight="800" fontFamily={TITLE_FONT} fill="#111">{title}</text>}
      <g transform={`translate(0 ${titleH})`}>
        {panels.map((p, i) => {
          if (i === 0) return null;
          const a = panelOrigin(i - 1, sides[i - 1]), b = panelOrigin(i, sides[i]);
          const ax = a.x + PANEL_W / 2, ay = a.y + PANEL_H, bx = b.x + PANEL_W / 2, by = b.y;
          return <path key={`c-${p.id}`} d={`M${ax},${ay} C${ax},${ay + 12} ${bx},${by - 12} ${bx},${by}`} fill="none" stroke="#111" strokeWidth="3" strokeDasharray="6 6" opacity="0.5" />;
        })}
        {resets.map((t, k) => {
          const i = panels.findIndex((p) => p.startedAt >= t);
          if (i <= 0) return null; // nothing before it to divide from
          const y = panelOrigin(i, sides[i]).y - GAP / 2;
          return <g key={`r-${k}`} className="divider"><line x1={GAP} y1={y} x2={width - GAP} y2={y} stroke="#111" strokeWidth="3" strokeDasharray="14 8" opacity="0.5" /><LabelPill x={width / 2 - labelWidth('NEW CONVERSATION') / 2} y={y - 12} text="NEW CONVERSATION" fill="#111" color="#ffd166" /></g>;
        })}
        {(() => {
          const lastModel: Partial<Record<Side, string>> = {};
          let lastSpeaker: number | undefined;
          return panels.map((p, i) => {
            const side = sides[i];
            const o = panelOrigin(i, side);
            const el = <Panel key={p.id} panel={p} index={i} x={o.x} y={o.y} side={side} layout={layout} agentSpeaking={agentSpeaking && !p.final} showTags={showTags} prevModel={lastModel[side]} prevSpeaker={p.role === 'user' ? lastSpeaker : undefined} />;
            lastModel[side] = p.model;
            if (p.role === 'user') lastSpeaker = p.speaker ?? 0;
            return el;
          });
        })()}
      </g>
    </svg>
  );
});

/** Rasterize and trigger a download; callers surface errors. */
export async function downloadStripPng(svg: SVGSVGElement, filename: string) {
  const blob = await stripToPng(svg);
  const url = URL.createObjectURL(blob);
  try { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 10_000); }
}

/** Rasterize the strip SVG to a PNG blob (2x). */
export async function stripToPng(svg: SVGSVGElement): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('svg render failed')); img.src = url; });
    const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
    const canvas = document.createElement('canvas');
    canvas.width = w * 2; canvas.height = h * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
