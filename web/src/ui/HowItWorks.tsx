import { useState } from 'react';
import { perHour } from '../lib/pricing';
import { useStore } from '../lib/store';
import { PageBar } from './PageBar';

const box = (x: number, y: number, w: number, h: number, title: string, sub?: string, fill = '#121a24', stroke = '#2a3a4f') => (
  <g key={title + x + y}>
    <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={stroke} strokeWidth="1.5" />
    <text x={x + w / 2} y={y + (sub ? 24 : h / 2 + 5)} textAnchor="middle" fontSize="14" fontWeight="700" fill="#e8eef6" fontFamily="Inter, system-ui, sans-serif">{title}</text>
    {sub && <text x={x + w / 2} y={y + 44} textAnchor="middle" fontSize="11" fill="#8fa1b8" fontFamily="ui-monospace, Menlo, monospace">{sub}</text>}
  </g>
);
const arrow = (x1: number, y1: number, x2: number, y2: number, label?: string, color = '#13ef95', dashed = false) => (
  <g key={`${x1}${y1}${x2}${y2}${label}`}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" markerEnd="url(#arr)" strokeDasharray={dashed ? '6 5' : undefined} />
    {label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fontSize="11" fill={color} fontFamily="ui-monospace, Menlo, monospace">{label}</text>}
  </g>
);
const defs = <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10z" fill="currentColor" /></marker></defs>;

function Architecture() {
  return (
    <svg viewBox="0 0 900 360" width="100%" style={{ color: '#13ef95', maxWidth: 900 }} role="img" aria-label="Architecture diagram">
      {defs}
      {box(20, 130, 170, 100, 'Browser', 'React + SVG comic engine')}
      {box(280, 130, 170, 100, 'Fly.io proxy', 'Node · express + ws')}
      {box(560, 20, 320, 90, 'Voice Agent API', 'wss://agent.deepgram.com/v1/agent/converse', '#0f1f19', '#13ef95')}
      {box(560, 135, 320, 90, 'Transcript layer', '/v2/listen (Flux STT) or /v1/listen (Nova-3)', '#101a2a', '#7aa2f7')}
      {box(560, 250, 320, 90, 'Text Intelligence', 'POST /v1/read · sentiment, intents, topics', '#1f1a10', '#ffd166')}
      {arrow(190, 165, 280, 165, 'mic PCM16 16k')}
      {arrow(280, 195, 190, 195, 'TTS PCM16 24k + JSON', '#8fa1b8')}
      {arrow(450, 150, 560, 70, 'same audio', '#13ef95')}
      {arrow(450, 180, 560, 180, 'same audio', '#7aa2f7')}
      {arrow(450, 200, 560, 290, 'final turn text', '#ffd166', true)}
      <text x="720" y="128" textAnchor="middle" fontSize="11" fill="#8fa1b8" fontFamily="ui-monospace, Menlo, monospace">Flux STT → Claude Haiku 4.5 → Flux TTS, one socket</text>
      <text x="450" y="330" textAnchor="middle" fontSize="12" fill="#8fa1b8" fontFamily="Inter, system-ui, sans-serif">The API key lives only on the proxy. The browser gets a short-lived session token and never talks to Deepgram directly.</text>
    </svg>
  );
}

function Lifecycle() {
  const steps = [
    ['UserStartedSpeaking', 'agent', 'if the robot is mid-sentence → barge-in: playback stops, bubble is cut, rest struck through'],
    ['TurnInfo · Update', 'listen', 'bubble fills word by word (interim transcript + word timings)'],
    ['TurnInfo · EndOfTurn', 'listen', 'panel finalizes · pace = words ÷ seconds → bubble style'],
    ['ConversationText · user', 'agent', 'authoritative text · languages[] → language tag'],
    ['vc.intel (read API)', 'proxy', 'sentiment → expression + background · topic → caption · |score| → SFX'],
    ['ConversationText · assistant', 'agent', 'new robot panel, text known up front'],
    ['audio frames', 'agent', 'gapless playback · bubble reveals at ~15 chars/s'],
    ['LatencyReport · total', 'agent', 'stamped on the robot panel as turn latency'],
    ['AgentAudioDone', 'agent', 'robot panel finalizes'],
  ];
  const colors: Record<string, string> = { agent: '#13ef95', listen: '#7aa2f7', proxy: '#ffd166' };
  return (
    <svg viewBox="0 0 900 420" width="100%" style={{ maxWidth: 900 }} role="img" aria-label="Turn lifecycle">
      {defs}
      <line x1="60" y1="20" x2="60" y2="400" stroke="#223042" strokeWidth="2" />
      {steps.map(([ev, src, what], i) => {
        const y = 30 + i * 42;
        return (
          <g key={ev}>
            <circle cx="60" cy={y} r="7" fill={colors[src]} />
            <text x="80" y={y + 4} fontSize="12" fontWeight="700" fill={colors[src]} fontFamily="ui-monospace, Menlo, monospace">{ev}</text>
            <text x="330" y={y + 4} fontSize="12" fill="#c8d3e0" fontFamily="Inter, system-ui, sans-serif">{what}</text>
          </g>
        );
      })}
    </svg>
  );
}

const BEATS = [
  { n: '1', title: 'You talk. Flux hears you, turn by turn.', body: 'Deepgram Flux speech-to-text streams your words into the bubble as you say them and decides when your turn is over. No push-to-talk.', chip: 'Flux STT' },
  { n: '2', title: 'The robot answers in its own voice.', body: 'Claude writes a one-line reply and Flux text-to-speech speaks it, all inside one Deepgram Voice Agent connection. Interrupt it and the bubble tears.', chip: 'Voice Agent API · Flux TTS' },
  { n: '3', title: 'Every drawing choice is a model signal.', body: 'Mood picks the face and background, pace picks the bubble, redaction draws the censor bars, and each panel shows what it cost. Switch models mid-sentence.', chip: 'Text Intelligence · Nova-3 redaction' },
];

export function HowItWorks({ onBack, onCast }: { onBack: () => void; onCast: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const [wire, setWire] = useState(false);
  const r = catalog?.rates;
  return (
    <div className="app">
      <PageBar title="How Voice Comic works"><span className="spacer" /><a href="https://github.com/dg-coreylweathers/voice-comic" target="_blank" rel="noreferrer"><button>Source on GitHub</button></a><button className="primary" onClick={onBack}>Back to the strip</button></PageBar>
      <div className="strip-scroll"><div className="strip-wrap how" style={{ maxWidth: 940, lineHeight: 1.55 }}>
        <h1 className="pitch">Talk to a comic. <span>Three things happen.</span></h1>
        <div className="beats">
          {BEATS.map((b) => (
            <div className="beat" key={b.n}>
              <div className="beat-n">{b.n}</div>
              <h3>{b.title}</h3>
              <p className="muted">{b.body}</p>
              <span className="chip">{b.chip}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', margin: '22px 0' }}>
          <button className={wire ? '' : 'primary'} onClick={() => setWire((w) => !w)} aria-expanded={wire}>{wire ? 'Hide the wire' : 'Show me the wire'}</button>
          <button onClick={onCast}>Meet the cast</button>
        </div>
        {wire && <div className="wire">
        <h2>1. Three Deepgram calls, one comic</h2>
        <p className="muted">The Voice Agent API runs the whole conversation: <b>Flux STT</b> hears you, <b>Claude Haiku 4.5</b> (Deepgram-managed Anthropic) writes the reply, <b>Flux TTS</b> speaks it, all over one WebSocket. The proxy tees your microphone into a second, plain STT stream so the bubbles can be drawn from the raw model events, and sends each finished turn to Text Intelligence for the mood.</p>
        <Architecture />
        <h2>2. What each event draws</h2>
        <Lifecycle />
        <h2>3. Why two STT streams?</h2>
        <p className="muted">The agent's own transcript arrives once per turn. The transcript layer is where the fun features live: Flux's interim <code>TurnInfo</code> updates fill the bubble live and carry word-level timestamps for replay; <code>eot</code> confidence is why the panel closes when it does; keyterms can be re-taught mid-session with <code>UpdateListen</code>. Flip <b>Redact</b> and the layer switches to Nova-3 with <code>redact=pii,pci,numbers</code> while the agent keeps listening with Flux, so you see two models hear the same audio at once. Switching the Listen, Brain or Voice dropdown sends <code>UpdateListen</code> / <code>UpdateThink</code> / <code>UpdateSpeak</code>; Flux is <code>version: v2</code>, Nova and Aura are <code>v1</code>. Pick the <b>Two people</b> scene and the agent goes away entirely: only Nova-3 runs, with <code>diarize=true</code>, and the strip splits a panel every time the other voice takes over. One stream, two speakers, no extra charge for diarization.</p>
        <h2>4. Latency you can read</h2>
        <p className="muted">Turn on <b>X-ray</b>. The agent sends <code>LatencyReport</code> messages per stage (STT, LLM, TTS, total). The robot panel is stamped with the total, and the log shows every raw event as it happens, including the ones this UI ignores.</p>
        <h2>5. Money</h2>
        <p className="muted">The cost chip shows whole cents and m:ss, never fractions of a penny or of a minute, and opens a breakdown that leads with one number you can budget with: what an hour of this conversation costs{r ? ` (Standard tier ${perHour(r.agentPerMinByTier.standard.promo)} with Claude Haiku 4.5, Advanced ${perHour(r.agentPerMinByTier.advanced.promo)} with Claude Sonnet)` : ''} and what a thousand conversations this long would cost. Under it, two bars on one scale: what the Voice Agent API bills (connection time, rate set by the LLM tier) and what the same STT seconds and TTS characters cost à la carte. The bars follow the models you actually selected, promo rates switch to regular after {r?.promoEnds} by themselves, and a two-people scene bills only its Nova-3 minutes. Every panel carries a tag with what was metered (seconds heard, characters spoken) and what a thousand panels like it would cost. Rates come from the public pricing page as of {r?.asOf}.</p>
        <h2>6. Run it yourself</h2>
        <pre className="muted" style={{ background: '#0a0e13', padding: 14, borderRadius: 12, overflow: 'auto' }}>{`git clone https://github.com/dg-coreylweathers/voice-comic && cd voice-comic
cp sample.env .env   # add DEEPGRAM_API_KEY
npm install && npm run dev
# deploy: fly launch --copy-config && fly secrets set DEEPGRAM_API_KEY=... && fly deploy`}</pre>
        <p className="muted">Docs: <a href="https://developers.deepgram.com/docs/flux/quickstart" style={{ color: 'var(--accent)' }}>Flux STT</a> · <a href="https://developers.deepgram.com/docs/flux-tts/overview" style={{ color: 'var(--accent)' }}>Flux TTS</a> · <a href="https://developers.deepgram.com/docs/voice-agent" style={{ color: 'var(--accent)' }}>Voice Agent API</a> · <a href="https://developers.deepgram.com/docs/redaction" style={{ color: 'var(--accent)' }}>Redaction</a> · <a href="https://developers.deepgram.com/docs/keyterm" style={{ color: 'var(--accent)' }}>Keyterm prompting</a></p>
        </div>}
      </div></div>
    </div>
  );
}
