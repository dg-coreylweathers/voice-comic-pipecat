import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';

export function XRay() {
  const events = useStore((s) => s.events);
  const latency = useStore((s) => s.latency);
  const layer = useStore((s) => s.listenLayer);
  const lastSettings = useStore((s) => s.lastSettings);
  const [open, setOpen] = useState<number | null>(null);
  const [interims, setInterims] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = logRef.current; if (el && open == null) el.scrollTop = el.scrollHeight; }, [events.length, open]);
  const NOISY = /^(TurnInfo\/Update|Results|History)$/;
  const tail = useMemo(() => { const src = interims ? events : events.filter((e) => !NOISY.test(e.type)); return src.slice(-400); }, [events, interims]);
  const settingsJson = useMemo(() => (lastSettings ? JSON.stringify(lastSettings, null, 2) : '// connect first: the proxy echoes the Settings it sends'), [lastSettings]);
  const copy = (text: string) => navigator.clipboard?.writeText(text);
  const ms = (v?: number) => (v == null ? '—' : `${Math.round(v * 1000)}`);
  return (
    <aside className="xray">
      <h3>X-ray · raw model events <label className="toggle" style={{ float: 'right', textTransform: 'none', letterSpacing: 0 }}><input type="checkbox" checked={interims} onChange={(e) => setInterims(e.target.checked)} /> interims</label></h3>
      <div className="metrics">
        <div className="metric"><b>{ms(latency.stt)}</b><span>STT ms</span></div>
        <div className="metric"><b>{ms(latency.ttt)}</b><span>LLM ms</span></div>
        <div className="metric"><b>{ms(latency.tts)}</b><span>TTS ms</span></div>
        <div className="metric"><b>{ms(latency.total)}</b><span>turn total</span></div>
      </div>
      <div className="layer">transcript layer: <code>{layer.state}</code> {layer.version} <code>{layer.model}</code>{layer.url && <><br /><code>wss://api.deepgram.com{layer.url}</code></>}</div>
      <div className="log" ref={logRef}>
        {tail.map((e, idx) => {
          return (
            <div key={`${e.t}-${idx}`} className={`ev src-${e.src}${open === idx ? ' open' : ''}`} onClick={() => setOpen(open === idx ? null : idx)}>
              <span className="t">{(e.t / 1000).toFixed(2)}</span><span className="src">{e.src}</span>
              <span><span className="type">{e.type}</span> <span className="sum">{open === idx && e.raw ? JSON.stringify(e.raw, null, 1) : e.summary}</span></span>
            </div>
          );
        })}
      </div>
      <div className="actions">
        <button onClick={() => copy(settingsJson)}>Copy agent Settings JSON</button>
        <button onClick={() => copy(`# same audio, straight to the model the bubbles are drawn from\nwebsocat -H "Authorization: Token $DEEPGRAM_API_KEY" "wss://api.deepgram.com${layer.url ?? '/v2/listen?model=flux-general-en&encoding=linear16&sample_rate=16000'}" < mic.pcm`)}>Copy transcript-layer websocat</button>
        <button onClick={() => copy(JSON.stringify(events, null, 1))}>Copy event log</button>
      </div>
    </aside>
  );
}
