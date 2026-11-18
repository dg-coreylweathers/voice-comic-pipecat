import { useCallback, useEffect, useRef, useState } from 'react';
import { Strip, downloadStripPng } from './comic/Strip';
import { changeSettings } from './lib/actions';
import { findExperience, isDuet } from './lib/experience';
import { BOOTH_BLURB, HOTKEYS, hotkeyFor } from './lib/hotkeys';
import { findMode } from './lib/modes';
import { ComicSession } from './lib/session';
import { store, toast, useStore } from './lib/store';
import type { Catalog, ExperienceKey } from './lib/types';
import { CastSheet } from './ui/CastSheet';
import { HowItWorks } from './ui/HowItWorks';
import { Consent, Share } from './ui/Modals';
import { Replay } from './ui/Replay';
import { Toolbar } from './ui/Toolbar';
import { Attract } from './ui/Attract';
import { Themes } from './ui/Themes';
import { XRay } from './ui/XRay';

/** Fields where keys are text, not commands: text-like inputs, textareas, selects, contenteditable. Checkboxes and buttons are not. */
function isTextEntry(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable) return true;
  return el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range'].includes(el.type);
}

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const h = () => setPath(location.pathname); window.addEventListener('popstate', h); return () => window.removeEventListener('popstate', h); }, []);
  const navigate = useCallback((p: string) => { history.pushState(null, '', p); setPath(p); }, []);
  return { path, navigate };
}

export function App() {
  const { path, navigate } = usePath();
  const catalog = useStore((s) => s.catalog);
  useEffect(() => {
    fetch('/api/catalog').then((r) => r.json())
      .then((c: Catalog) => { store.set({ catalog: c }); changeSettings(null, { listenKey: c.defaults.listen, speakKey: c.defaults.speak, thinkKey: c.defaults.think, modeKey: c.defaults.mode, booth: !!c.booth?.enabled }); }) // booth implies redact, in one place
      .catch(() => toast('Could not load model catalog'));
  }, []);
  if (!catalog) return <div className="hero"><p className="muted">Loading…</p></div>;
  const replay = path.match(/^\/(?:s|replay)\/([A-Za-z0-9]+)/);
  if (replay) return <Replay id={replay[1]} onHome={() => navigate('/')} />;
  if (path === '/how') return <HowItWorks onBack={() => navigate('/')} onCast={() => navigate('/cast')} />;
  if (path === '/cast') return <CastSheet onBack={() => navigate('/')} />;
  if (path === '/themes') return <Themes onBack={() => navigate('/')} />;
  return <Live catalog={catalog} onHow={() => navigate('/how')} onThemes={() => navigate('/themes')} />;
}

function Live({ catalog, onHow, onThemes }: { catalog: Catalog; onHow: () => void; onThemes: () => void }) {
  const panels = useStore((s) => s.panels);
  const resets = useStore((s) => s.resets);
  const conn = useStore((s) => s.conn);
  const xray = useStore((s) => s.settings.xray);
  const agentSpeaking = useStore((s) => s.agentSpeaking);
  const saved = useStore((s) => s.saved);
  const booth = useStore((s) => s.settings.booth);
  const redact = useStore((s) => s.settings.redact);
  const duet = useStore((s) => isDuet(s.settings));
  const experience = useStore((s) => s.settings.experience);
  const toastMsg = useStore((s) => s.toast);
  const [session, setSession] = useState<ComicSession | null>(null);
  const sessionRef = useRef<ComicSession | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroll.current; if (el) el.scrollTop = el.scrollHeight; }, [panels.length]);

  const start = useCallback(async () => {
    if (!store.get().consented) { setAskConsent(true); return; }
    const s = sessionRef.current ?? new ComicSession(catalog);
    sessionRef.current = s;
    setSession(s);
    try { await s.connect(); } catch (e) { toast(`Could not start: ${(e as Error).message}`); s.stop(); store.set({ conn: 'idle' }); }
  }, [catalog]);
  /** The hero's two doors: pick the scene, then open the mic. */
  const startAs = (experience: ExperienceKey) => { changeSettings(sessionRef.current, { experience }); void start(); };
  const toggleDuet = () => { const next: ExperienceKey = store.get().settings.experience === 'duet' ? 'agent' : 'duet'; changeSettings(sessionRef.current, { experience: next }); toast(`Scene: ${findExperience(catalog, next)?.label ?? next}`); };
  const stop = () => sessionRef.current?.stop();
  const pause = () => sessionRef.current?.pause();
  const resume = () => sessionRef.current?.resume();
  const reset = () => { const s = sessionRef.current; if (!s || store.get().conn !== 'live') return; void s.resetConversation(); toast(isDuet(store.get().settings) ? 'New conversation: divider drawn' : 'New conversation: Flux forgot the last one'); };
  const nextMode = () => { if (isDuet(store.get().settings)) { toast('Modes belong to Flux chat; this scene has no agent'); return; } const modes = catalog.modes; const cur = findMode(catalog, store.get().settings.modeKey); const m = modes[(modes.indexOf(cur!) + 1) % modes.length]; changeSettings(sessionRef.current, { modeKey: m.key }); toast(`Mode: ${m.label}`); };
  const fresh = () => { sessionRef.current?.stop(); const s = ComicSession.fresh(catalog); sessionRef.current = s; setSession(s); };
  /** Operator panic button: the strip, its events and any recording buffers are gone; nothing was saved. */
  const wipe = () => {
    const { panels: had, saved: wasSaved } = store.get();
    fresh(); setShare(null);
    if (wasSaved) toast(`Strip wiped from the screen. Its saved link still exists${wasSaved.booth ? ' until it expires' : ''}.`);
    else if (had.length) toast('Strip wiped. Nothing was saved.');
  };
  const save = async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const title = panels.find((p) => p.role === 'user')?.text.split(/[.!?]/)[0].slice(0, 60) || 'Voice comic'; // the server neutralises it for booth strips
      if (store.get().conn === 'live') s.stop();
      const r = await s.save(title);
      setShare(r.url);
    } catch (e) { toast((e as Error).message); }
  };
  const png = async () => { try { if (svg.current) await downloadStripPng(svg.current, 'voice-comic.png'); } catch (e) { toast(`PNG export failed: ${(e as Error).message}`); } };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextEntry(e.target)) return; // typing wins; everywhere else the operator hotkeys own their keys
      const id = hotkeyFor(e.key);
      if (!id) return;
      e.preventDefault(); // a focused button or checkbox must not also fire on space
      const s = sessionRef.current;
      switch (id) {
        case 'xray': changeSettings(s, { xray: !store.get().settings.xray }); break;
        case 'redact': changeSettings(s, { redact: !store.get().settings.redact }); break;
        case 'booth': {
          if (store.get().catalog?.booth?.enabled) { toast('Booth mode is forced on by this deployment'); break; }
          const on = !store.get().settings.booth; changeSettings(s, { booth: on }); toast(on ? `Booth mode on: ${BOOTH_BLURB}` : 'Booth mode off'); break;
        }
        case 'wipe': wipe(); break;
        case 'pause': if (store.get().conn === 'live') { if (store.get().paused) resume(); else pause(); } break;
        case 'reset': reset(); break;
        case 'mode': nextMode(); break;
        case 'duet': toggleDuet(); break;
        case 'stop': if (store.get().conn === 'live') s?.stop(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar session={session} onStart={start} onStop={stop} onPause={pause} onResume={resume} onReset={reset} onSave={save} onNew={fresh} onHow={onHow} onThemes={onThemes} />
      <main className={`stage${xray ? ' xray-open' : ''}`}>
        <div className="strip-scroll" ref={scroll}>
          {panels.length === 0 && conn !== 'live' && conn !== 'connecting' ? (
            <div className="hero"><div>
              <h1>Talk. <span>Watch it get drawn.</span></h1>
              <p>A live comic strip powered by Deepgram Flux speech-to-text and Flux text-to-speech through the Voice Agent API. Every turn is a panel. Your mood picks the art. Interrupt Flux and see the bubble tear. Or bring a friend: Nova-3 tells your voices apart and draws you both.</p>
              <div className="starts">
                <button className="primary big" onClick={() => startAs('agent')}>● Talk to Flux<small>Voice Agent API · Flux STT + TTS</small></button>
                <button className="big alt" onClick={() => startAs('duet')}>👥 Two people talking<small>Nova-3 diarization · no agent</small></button>
              </div>
              <Attract />
              <p className="muted" style={{ marginTop: 14 }}><a href="/themes" onClick={(e) => { e.preventDefault(); onThemes(); }} style={{ color: 'var(--accent)' }}>What people talk about at this booth →</a></p>
              <div className="features"><span>Flux STT · turn detection</span><span>Flux TTS · barge-in</span><span>Nova-3 · live redaction</span><span>Nova-3 · speaker diarization</span><span>Keyterm prompting</span><span>Text Intelligence</span><span>Replay with word timestamps</span><span>Live cost meter</span></div>
              <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>{HOTKEYS.map((h, i) => <span key={h.key}>{i ? ' · ' : ''}<kbd>{h.show ?? h.key}</kbd> {h.label}</span>)}</p>
            </div></div>
          ) : (
            <div className="strip-wrap">
              {panels.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>{duet ? 'Listening… talk to each other. Nova-3 will tell you apart.' : 'Listening… say hello to the robot.'}</p>}
              <Strip ref={svg} panels={panels} agentSpeaking={agentSpeaking} resets={resets} layout={experience} />
            </div>
          )}
        </div>
        {xray && <XRay />}
      </main>
      {askConsent && <Consent booth={booth} redact={redact} duet={duet} ttlHours={catalog.booth?.transcriptTtlHours ?? 2} onAccept={() => { store.set({ consented: true }); setAskConsent(false); void start(); }} onCancel={() => setAskConsent(false)} />}
      {share && saved && <Share url={share} booth={saved.booth} expiresAt={saved.expiresAt} onClose={() => setShare(null)} onPng={png} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
