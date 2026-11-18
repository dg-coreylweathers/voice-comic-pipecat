import { useEffect, useMemo, useRef, useState } from 'react';
import { Strip, downloadStripPng } from '../comic/Strip';
import { REVEAL_CPS, revealedChars } from '../lib/director';
import { clockTime } from '../lib/format';
import { computeCost, mmss, price } from '../lib/pricing';
import { toast, useStore } from '../lib/store';
import type { Panel, SavedStrip } from '../lib/types';
import { PageBar } from './PageBar';

/** Rebuilds what the strip looked like at session time t (ms), using the timing recorded live. */
export function panelsAt(panels: Panel[], t: number): Panel[] {
  return panels.filter((p) => p.startedAt <= t).map((p) => {
    if (p.role === 'user') {
      const end = p.endedAt ?? p.startedAt + 1500;
      if (t >= end) return p;
      if (p.words?.length) {
        const shown = p.words.filter((w) => w.end * 1000 <= t).map((w) => w.word).join(' ');
        return { ...p, text: shown || '…', final: false };
      }
      const frac = (t - p.startedAt) / (end - p.startedAt);
      return { ...p, text: p.text.slice(0, Math.floor(p.text.length * frac)) || '…', final: false };
    }
    const end = p.endedAt ?? (p.spokenAt ?? p.startedAt) + (p.text.length / REVEAL_CPS) * 1000;
    if (t >= end) return p;
    const live = { ...p, final: false, interruptedAt: undefined };
    return { ...live, spokenChars: Math.min(revealedChars(live, t), p.interruptedAt ?? p.text.length) };
  });
}

export function Replay({ id, onHome }: { id: string; onHome: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const [strip, setStrip] = useState<SavedStrip | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    fetch(`/api/strips/${id}`)
      .then(async (r) => { if (!r.ok) throw new Error(r.status === 404 ? 'That strip does not exist (strips are demo data and audio expires).' : `HTTP ${r.status}`); setStrip(await r.json()); })
      .catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const shown = useMemo(() => (strip ? (t == null ? strip.panels : panelsAt(strip.panels, t)) : []), [strip, t]);
  const cost = useMemo(() => (strip && catalog ? computeCost({ ...strip.usage, disconnectedAt: strip.usage.disconnectedAt ?? (strip.usage.connectedAt ?? 0) + strip.durationMs }, catalog) : null), [strip, catalog]);

  if (err) return <div className="hero"><div><h1>Hmm.</h1><p>{err}</p><button className="primary big" onClick={onHome}>Draw your own</button></div></div>;
  if (!strip) return <div className="hero"><p className="muted">Loading strip…</p></div>;

  const dur = strip.durationMs + 1500;
  const animate = () => {
    cancelAnimationFrame(raf.current);
    const start = performance.now() - (t ?? 0);
    setPlaying(true);
    const step = () => {
      const now = performance.now() - start;
      if (now >= dur) { setT(null); setPlaying(false); return; }
      setT(now);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const play = () => {
    const a = audio.current;
    if (!a) { if (playing) { cancelAnimationFrame(raf.current); setPlaying(false); } else animate(); return; }
    if (a.paused) { a.currentTime = t != null && t < dur ? t / 1000 : 0; void a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };
  const download = async () => { try { if (svg.current) await downloadStripPng(svg.current, `voice-comic-${id}.png`); } catch (e) { toast(`PNG export failed: ${(e as Error).message}`); } };
  const firstUser = strip.panels.find((p) => p.role === 'user');
  const firstAgent = strip.panels.find((p) => p.role === 'agent');

  return (
    <div className="app">
      <PageBar title="Voice Comic" subtitle={strip.title || 'Untitled strip'}>
        <button className="primary" onClick={play}>{playing ? '❚❚ Pause' : '▶ Replay'}</button>
        <input type="range" min={0} max={dur} value={t ?? dur} onChange={(e) => { const v = Number(e.target.value); setT(v >= dur ? null : v); if (audio.current) audio.current.currentTime = v / 1000; }} />
        <span className="chip">{((t ?? dur) / 1000).toFixed(1)}s / {(dur / 1000).toFixed(1)}s</span>
        {cost && <span className="chip" title={strip.usage.server ? 'metered by the server' : 'estimated by the client'}>{price(cost.bundledTotal)} · {mmss(cost.talkMs)}</span>}
        <span className="chip">{strip.settings?.experience === 'duet' ? `${firstUser?.model ?? 'nova-3'} · two speakers, no agent` : `${firstUser?.model ?? 'flux'} → ${firstAgent?.model ?? 'flux'}`}</span>
        {strip.booth && <span className="chip" title="Booth mode: no recording, trimmed event log, short-lived link">booth · expires {strip.expiresAt ? clockTime(strip.expiresAt) : 'soon'}</span>}
        <button onClick={download}>PNG</button>
        <button onClick={onHome}>Draw your own</button>
        {strip.hasAudio && <audio ref={audio} src={`/api/strips/${id}/audio`} onTimeUpdate={(e) => setT(e.currentTarget.currentTime * 1000)} onEnded={() => { setT(null); setPlaying(false); }} onPause={() => setPlaying(false)} />}
      </PageBar>
      <div className="strip-scroll"><div className="strip-wrap"><Strip ref={svg} panels={shown} title={strip.title} resets={strip.resets} layout={strip.settings?.experience ?? 'agent'} /></div></div>
    </div>
  );
}
