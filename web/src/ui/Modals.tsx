import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { clockTime } from '../lib/format';

export function Consent({ booth, redact, duet = false, ttlHours, onAccept, onCancel }: { booth: boolean; redact: boolean; duet?: boolean; ttlHours: number; onAccept: () => void; onCancel: () => void }) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Before we draw you</h2>
        {duet
          ? <p>This scene streams your microphone to Deepgram Nova-3, which transcribes both of you and tells your voices apart. No AI agent listens or replies. What you say appears on this screen as comic panels, one per speaker turn.</p>
          : <p>This demo streams your microphone to Deepgram for live speech recognition and to an LLM that writes Flux's replies. What you say appears on this screen as comic panels.</p>}
        {booth ? (
          <ul>
            <li><b>Booth mode is on.</b> Your audio is never stored, here or on the server. {redact ? 'Redaction is on: names, numbers and card details are blacked out in your panels before they reach the page.' : 'Redaction has been switched off, so what you say appears as said.'}</li>
            <li>Nothing is saved unless you press <b>Save &amp; share</b>. A saved strip keeps the panels only (no recording, no raw event log) and is deleted after about {ttlHours} hour{ttlHours === 1 ? '' : 's'}.</li>
            {!duet && <li>Honest caveat: the LLM still hears you unredacted and its spoken reply might repeat something you said. We instruct it not to; do not rely on that for real secrets.</li>}
          </ul>
        ) : (
          <ul>
            <li>Nothing is stored unless you press <b>Save &amp; share</b>. Saved audio is deleted automatically after 24 hours; the transcript strip stays at its link.</li>
            <li>Skip passwords, card numbers, and other secrets. Or turn on <b>Redact</b> and watch them get censored live.</li>
            {duet ? <li>Take turns, or do not: the strip splits a panel whenever Nova-3 hears the other voice.</li> : <li>Interrupt Flux mid-sentence. That is a feature.</li>}
          </ul>
        )}
        <div className="row"><button className="primary" onClick={onAccept}>I'm in, start the mic</button><button onClick={onCancel}>Not now</button></div>
      </div>
    </div>
  );
}

export function Share({ url, booth, expiresAt, onClose, onPng }: { url: string; booth?: boolean; expiresAt?: number; onClose: () => void; onPng: () => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const abs = new URL(url, location.href).href;
  useEffect(() => { if (canvas.current) QRCode.toCanvas(canvas.current, abs, { width: 200, margin: 1, color: { dark: '#0b0f14', light: '#ffffff' } }).catch(() => {}); }, [abs]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Your strip is saved</h2>
        <div className="share">
          <canvas ref={canvas} width={200} height={200} />
          <div>
            {booth ? <p>Scan to open it on your phone. Booth mode: the strip has no recording and the link stops working {expiresAt ? `at ${clockTime(expiresAt)}` : 'in a couple of hours'}. Download the PNG to keep it.</p>
              : <p>Scan to open it on your phone. The replay re-animates every bubble against the recording, using the word timestamps Deepgram returned.</p>}
            <input type="text" readOnly value={abs} onFocus={(e) => e.currentTarget.select()} />
            <div className="row">
              <button className="primary" onClick={() => { navigator.clipboard?.writeText(abs); setCopied(true); }}>{copied ? 'Copied' : 'Copy link'}</button>
              <button onClick={() => onPng()}>Download PNG</button>
              <a href={url} target="_blank" rel="noreferrer"><button>Open replay</button></a>
            </div>
            <p className="muted" style={{ marginTop: 14 }}>Want the code? <a href="https://github.com/dg-coreylweathers/voice-comic" style={{ color: 'var(--accent)' }}>github.com/dg-coreylweathers/voice-comic</a></p>
          </div>
        </div>
        <div className="row"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
