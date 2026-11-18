import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadStripPng } from '../comic/Strip';
import { COMIC_FONT, PAPER, TITLE_FONT } from '../comic/Tag';
import { layoutCloud, tone } from '../lib/cloud';
import { toast } from '../lib/store';
import type { Themes as ThemesT } from '../lib/types';
import { PageBar } from './PageBar';

const W = 920, H = 460;

/** What people talk about at the booth: a deterministic word cloud of Text Intelligence topics plus the booth taxonomy, refreshed every ten seconds. */
export function Themes({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<ThemesT | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const qs = event ? `?event=${encodeURIComponent(event)}` : '';
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/themes${qs}`).then((r) => r.json()).then((d: ThemesT) => { if (alive) setData((prev) => (JSON.stringify(prev) === JSON.stringify(d) ? prev : d)); }).catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [qs]);
  const words = useMemo(() => (data ? layoutCloud(data.topics, W, H) : []), [data]);
  const cats = data?.categories ?? [];
  const maxCat = cats[0]?.count ?? 1;
  const png = async () => { try { if (svg.current) await downloadStripPng(svg.current, `voice-comic-themes-${data?.event ?? 'booth'}.png`); } catch (e) { toast(`PNG export failed: ${(e as Error).message}`); } };
  return (
    <div className="app">
      <PageBar title="What people talk about" subtitle={data ? `${data.event} · ${data.turns} visitor turn${data.turns === 1 ? '' : 's'}` : undefined}>
        {data && data.events.length > 1 && <select aria-label="Event" value={event ?? data.event} onChange={(e) => setEvent(e.target.value)}>{data.events.map((e) => <option key={e.event} value={e.event}>{e.event} · {e.turns}</option>)}</select>}
        <span className="spacer" />
        <a href={`/api/themes.csv${qs}`}><button>Download CSV</button></a>
        <button onClick={png}>PNG</button>
        <button className="primary" onClick={onBack}>Back to the strip</button>
      </PageBar>
      <div className="strip-scroll"><div className="strip-wrap themes">
        {err && <p className="muted">Could not load themes: {err}</p>}
        {data && data.turns === 0 && <p className="muted" style={{ textAlign: 'center' }}>Nothing tallied yet for {data.event}. Every finished visitor turn adds its topics here; no text is kept.</p>}
        <svg ref={svg} className="strip cloud" viewBox={`0 0 ${W} ${H + 40}`} width={W} height={H + 40} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Word cloud of booth topics">
          <rect width={W} height={H + 40} fill={PAPER} />
          <text x={14} y={30} fontSize="24" fontWeight="800" fontFamily={TITLE_FONT} fill="#111">What people talk about{data ? ` · ${data.event}` : ''}</text>
          <g transform="translate(0 40)">
            {words.map((p) => <text key={p.term} x={p.x} y={p.y + p.size * 0.35} textAnchor="middle" fontSize={p.size} fontWeight="800" fontFamily={COMIC_FONT} fill={p.color} className="cloud-word"><title>{p.count} turn{p.count === 1 ? '' : 's'}</title>{p.term}</text>)}
          </g>
          <g transform={`translate(${W - 200} ${H + 30})`} fontFamily={COMIC_FONT} fontSize="11" fill="#111">
            <circle cx="0" cy="-4" r="5" fill={tone(1)} /><text x="10" y="0">sounded happy</text>
            <circle cx="110" cy="-4" r="5" fill={tone(-1)} /><text x="120" y="0">sounded upset</text>
          </g>
        </svg>
        {cats.length > 0 && (
          <div className="taxonomy">
            <h3>What they asked about</h3>
            {cats.map((c) => <div className="bar-row" key={c.term}><span>{c.term}</span><div className="bar"><i style={{ width: `${Math.max(4, (c.count / maxCat) * 100)}%` }} /></div><b>{c.count}</b></div>)}
            <p className="muted">Counted from finished visitor turns against a small booth taxonomy (pricing, latency, languages, self-hosted, SDKs and so on). Only terms and counts are stored; transcripts never are.</p>
          </div>
        )}
      </div></div>
    </div>
  );
}
