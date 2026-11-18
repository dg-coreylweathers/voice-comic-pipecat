import { useState } from 'react';
import { changeSettings } from '../lib/actions';
import { findExperience, isDuet } from '../lib/experience';
import { BOOTH_BLURB } from '../lib/hotkeys';
import { findMode } from '../lib/modes';
import { useStore } from '../lib/store';
import type { ComicSessionApi } from '../lib/session';
import type { ExperienceKey } from '../lib/types';
import { CostChip } from './CostMeter';

interface Props { session: ComicSessionApi | null; onStart: () => void; onStop: () => void; onPause: () => void; onResume: () => void; onReset: () => void; onSave: () => void; onNew: () => void; onHow: () => void; onThemes: () => void }

/** Two rows: what the operator reaches for mid-pitch (scene, transport, mode) on top; the model rack underneath. In a duet the agent-only controls step aside. */
export function Toolbar({ session, onStart, onStop, onPause, onResume, onReset, onSave, onNew, onHow, onThemes }: Props) {
  const catalog = useStore((s) => s.catalog);
  const settings = useStore((s) => s.settings);
  const conn = useStore((s) => s.conn);
  const paused = useStore((s) => s.paused);
  const panels = useStore((s) => s.panels);
  const voices = useStore((s) => s.voices);
  const [kt, setKt] = useState(settings.keyterms.join(', '));
  const [line, setLine] = useState('');
  const live = conn === 'live';
  if (!catalog) return null;

  const duet = isDuet(settings);
  const applyKeyterms = () => changeSettings(session, { keyterms: kt.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20) });
  const sendLine = () => { if (line.trim() && live) { session?.injectText(line.trim()); setLine(''); } };
  const status = conn === 'connecting' ? 'connecting' : live ? (paused ? 'paused' : 'live') : panels.length ? 'stopped' : 'idle';
  const mode = findMode(catalog, settings.modeKey);
  const experience = findExperience(catalog, settings.experience);
  const listenOptions = duet ? catalog.listen.filter((m) => m.family === 'nova') : catalog.listen;

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <div className="brand"><div className="logo">VC</div><span className="brand-text">Voice Comic</span></div>
        <div className="group" title={experience?.blurb}><label>Scene</label>
          <select aria-label="Scene" value={settings.experience} onChange={(e) => changeSettings(session, { experience: e.target.value as ExperienceKey })}>{catalog.experiences.map((x) => <option key={x.key} value={x.key} title={x.label}>{x.short}</option>)}</select>
        </div>
        <div className="transport" role="group" aria-label="Transport">
          {live || conn === 'connecting'
            ? <>
                {paused ? <button className="primary" onClick={onResume} title="Resume the mic (space)">▶ Resume</button> : <button onClick={onPause} disabled={!live} title="Mute the mic, keep the conversation (space)">❚❚ Pause</button>}
                <button className="danger" onClick={onStop} title="Close the mic and the connection (Esc)">■ Stop</button>
              </>
            : <button className="primary" onClick={onStart} title="Open the mic">● {panels.length ? 'Continue' : 'Start talking'}</button>}
          <button onClick={onReset} disabled={!live} title={duet ? 'New conversation: draw a divider before the next topic (n)' : 'New conversation: Flux forgets the context, the strip keeps going (n)'}>↺ New chat</button>
          <button onClick={onNew} disabled={panels.length === 0 && conn === 'idle'} title="Clear the strip (w wipes instantly)">✕ Strip</button>
        </div>
        <span className={`status status--${status}`} aria-live="polite">{status.toUpperCase()}</span>
        {!duet && <div className="group" title={mode?.blurb}><label>Mode</label>
          <select aria-label="Mode" value={settings.modeKey} onChange={(e) => changeSettings(session, { modeKey: e.target.value })}>{catalog.modes.map((m) => <option key={m.key} value={m.key} title={m.label}>{m.short ?? m.label}</option>)}</select>
        </div>}
        {!duet && <label className="toggle group" title="Two people at the mic while Flux still answers: the transcript layer runs Nova-3 with diarization and each speaker gets their own panels"><input type="checkbox" checked={settings.speakers} onChange={(e) => changeSettings(session, { speakers: e.target.checked })} /> Two speakers</label>}
        {duet && <span className="chip voices" title="Nova-3 labels every word with a speaker and the strip splits panels on the hand-off. Streaming diarization warms up: the first exchanges may land on one speaker until it has heard enough of both.">{voices >= 2 ? `Nova-3 told ${voices} voices apart` : live && !paused ? 'Nova-3 diarization · learning your voices…' : 'Nova-3 diarization · no agent'}</span>}
        <div className="spacer" />
        <CostChip />
        <button onClick={onThemes} title="What people talk about at this booth">Themes</button>
        <button onClick={onHow}>How it works</button>
        <button onClick={onSave} disabled={panels.length === 0 || conn === 'connecting'}>Save & share</button>
      </div>
      <div className="toolbar-row secondary">
        <div className="group"><label>Listen</label>
          <select aria-label="Listen model" value={settings.listenKey} onChange={(e) => changeSettings(session, { listenKey: e.target.value })}>{listenOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
        </div>
        {!duet && <div className="group"><label>Voice</label>
          <select aria-label="Voice model" value={settings.speakKey} onChange={(e) => changeSettings(session, { speakKey: e.target.value })}>{catalog.speak.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
        </div>}
        {!duet && <div className="group"><label>Brain</label>
          <select aria-label="LLM model" value={settings.thinkKey} onChange={(e) => changeSettings(session, { thinkKey: e.target.value })}>{catalog.think.map((m) => <option key={m.key} value={m.key}>{m.label} · {m.tier === 'advanced' ? 'Advanced' : 'Standard'}</option>)}</select>
        </div>}
        <div className="group"><label>Keyterms</label>
          <input type="text" value={kt} onChange={(e) => setKt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyKeyterms()} placeholder="Deepgram, Fly.io, your startup" style={{ width: 170 }} />
          <button onClick={applyKeyterms}>Teach</button>
        </div>
        <label className="toggle group" title={`${catalog.booth?.enabled ? 'Forced on by this deployment' : 'Public venue'}: ${BOOTH_BLURB}`}><input type="checkbox" checked={settings.booth} disabled={!!catalog.booth?.enabled} onChange={(e) => changeSettings(session, { booth: e.target.checked })} /> Booth</label>
        <label className="toggle group" title={duet ? 'Nova-3 redacts PII, PCI and numbers before they reach the page' : 'Runs the transcript layer on Nova-3 with PII/PCI/number redaction; the agent keeps listening with your chosen model'}><input type="checkbox" checked={settings.redact} onChange={(e) => changeSettings(session, { redact: e.target.checked })} /> Redact</label>
        <label className="toggle group" title="Show raw Deepgram events, latency, and copyable requests"><input type="checkbox" checked={settings.xray} onChange={(e) => changeSettings(session, { xray: e.target.checked })} /> X-ray</label>
        {!duet && <div className="group"><input type="text" value={line} disabled={!live} onChange={(e) => setLine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendLine()} placeholder={live ? 'Too loud? Type a line…' : 'Type a line (when live)'} style={{ width: 160 }} /></div>}
      </div>
    </header>
  );
}
