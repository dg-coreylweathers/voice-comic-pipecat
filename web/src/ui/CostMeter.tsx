import { useMemo, useState } from 'react';
import { COLORS, atScale, computeCost, mmss, perHour, price, rateBoth, ttsRate, type CostLine } from '../lib/pricing';
import { duetListenKey, isDuet } from '../lib/experience';
import { useStore } from '../lib/store';

export function CostChip() {
  const catalog = useStore((s) => s.catalog);
  const usage = useStore((s) => s.usage);
  const conn = useStore((s) => s.conn);
  useStore((s) => s.clock);
  const [open, setOpen] = useState(false);
  if (!catalog) return null;
  const cost = computeCost(usage, catalog);
  const title = cost.hourly != null ? `${perHour(cost.hourly / 60)} at this rate · tap for the breakdown` : 'Where the money goes';
  return (
    <>
      <button className={`chip ${conn === 'live' ? 'live' : ''}`} onClick={() => setOpen(true)} title={title}>
        {price(cost.bundledTotal)} · {mmss(cost.talkMs)}
      </button>
      {open && <CostModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** One horizontal stacked bar; widths are shares of `max` so two bars are comparable. */
function Bar({ lines, max, title, total }: { lines: CostLine[]; max: number; title: string; total: number }) {
  const W = 620, H = 34;
  let x = 0;
  return (
    <div className="bar">
      <div className="bar-head"><span>{title}</span><b>{price(total)}</b></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${title}: ${lines.map((l) => `${l.label} ${price(l.amount)}`).join(', ')}`}>
        <rect width={W} height={H} rx="8" fill="#0f141b" />
        {lines.map((l) => {
          const w = max > 0 ? Math.max(l.amount > 0 ? 3 : 0, (l.amount / max) * W) : 0;
          const el = <g key={l.key}><rect x={x} y={0} width={w} height={H} fill={l.color} rx={2}><title>{l.label}: {price(l.amount)}</title></rect>{w > 70 && <text x={x + 8} y={22} fontSize="12" fontWeight="700" fill="#06140d" fontFamily="Inter, system-ui, sans-serif">{price(l.amount)}</text>}</g>;
          x += w;
          return el;
        })}
        {lines.length === 0 && <text x={10} y={22} fontSize="12" fill="#8fa1b8">nothing metered yet</text>}
      </svg>
      <ul className="legend">{lines.map((l) => <li key={l.key}><i style={{ background: l.color }} />{l.label} <span>{l.note}</span></li>)}</ul>
    </div>
  );
}

export function CostModal({ onClose }: { onClose: () => void }) {
  const catalog = useStore((s) => s.catalog)!;
  const usage = useStore((s) => s.usage);
  const settings = useStore((s) => s.settings);
  useStore((s) => s.clock);
  const c = computeCost(usage, catalog);
  const r = catalog.rates;
  const { promo } = c;
  // What has been metered decides the copy; before anything is metered, the chosen scene does.
  const duet = usage.connectedAt ? c.duet : isDuet(settings);
  const think = catalog.think.find((t) => t.key === settings.thinkKey) ?? catalog.think[0];
  const tier = r.agentPerMinByTier[think.tier];
  const tierRate = promo ? tier.promo : tier.regular;
  const listen = catalog.listen.find((l) => l.key === settings.listenKey) ?? catalog.listen[0];
  const layer = catalog.listen.find((l) => l.key === duetListenKey(catalog, listen.key)) ?? listen; // the Nova-3 twin that actually runs in a duet
  const speak = catalog.speak.find((s) => s.key === settings.speakKey) ?? catalog.speak[0];
  const { fluxTts, auraTts, standardBrains, advancedBrains, sttRates } = useMemo(() => ({
    fluxTts: catalog.speak.find((s) => s.family === 'flux'),
    auraTts: catalog.speak.find((s) => s.family === 'aura'),
    standardBrains: catalog.think.filter((t) => t.tier === 'standard').map((t) => t.label).join(', '),
    advancedBrains: catalog.think.filter((t) => t.tier === 'advanced').map((t) => t.label).join(', '),
    sttRates: catalog.listen.map((l) => `${l.label} ${perHour(l.ratePerMin)}`).join(', '),
  }), [catalog]);
  const fluxRate = fluxTts ? ttsRate(catalog, fluxTts, usage.disconnectedAt ?? Date.now()) : 0;
  const max = Math.max(c.bundledTotal, c.alaCarteTotal, 1e-6);
  const llmLine: CostLine = { key: 'llm', label: 'Your LLM (not billed by Deepgram)', amount: 0, note: 'à la carte you bring your own model bill', color: COLORS.llm };
  const rateNote = promo ? `promo rates through ${r.promoEnds}` : `regular rates; the launch promo ended ${r.promoEnds}`;
  // Before anything is metered, the hourly figure is the rate card for what is selected.
  const hourlyRate = c.hourly != null ? c.hourly / 60 : duet ? layer.ratePerMin : tierRate;
  const metered = c.talkMs >= 1000;
  const std = promo ? r.agentPerMinByTier.standard.promo : r.agentPerMinByTier.standard.regular;
  const adv = promo ? r.agentPerMinByTier.advanced.promo : r.agentPerMinByTier.advanced.regular;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal cost" onClick={(e) => e.stopPropagation()}>
        <h2>Where the money goes</h2>
        <div className="cost-head">
          <div className="cost-big">{metered ? price(c.bundledTotal) : perHour(hourlyRate)}</div>
          <div className="cost-sub">
            {metered
              ? <>for {mmss(c.talkMs)} of conversation · <b>{perHour(hourlyRate)}</b> at this rate · a thousand conversations this long: <b>{atScale(c.bundledTotal)}</b></>
              : <>for an hour of {duet ? `${layer.label} with two speakers` : `talking to Flux on the ${tier.label} tier`}; start talking and this becomes what your conversation actually cost</>}
          </div>
        </div>
        <p className="muted">Live estimate from public pay-as-you-go rates (as of {r.asOf}; {rateNote}). {duet ? 'No agent in this scene: the Nova-3 stream is the whole bill, and diarization is included in its per-minute price.' : 'Bars share one scale so you can compare the bundle with the same conversation built from parts.'}</p>
        {duet
          ? <Bar title={`As built: ${layer.label} streaming, two speakers, ${perHour(layer.ratePerMin)}`} lines={c.bundled} max={max} total={c.bundledTotal} />
          : <>
              <Bar title={`As built: Voice Agent API (${think.label} → ${tier.label} tier, ${perHour(tierRate)} ${promo ? 'promo' : 'regular'})`} lines={c.bundled} max={max} total={c.bundledTotal} />
              <Bar title={`Same conversation à la carte (${listen.label} minutes + ${speak.label} characters + add-ons)`} lines={[...c.alaCarte, llmLine]} max={max} total={c.alaCarteTotal} />
            </>}
        <div className="explain">
          <b>How Deepgram pricing works, in numbers you can budget with</b>
          <ul>
            {!duet && <li><b>Voice Agent API</b> bills the time the WebSocket is connected, at a per-minute rate set by the LLM tier. Standard ({standardBrains}) is {rateBoth(std)}; Advanced ({advancedBrains}) is {rateBoth(adv)}{promo ? `; after ${r.promoEnds} those become ${perHour(r.agentPerMinByTier.standard.regular)} and ${perHour(r.agentPerMinByTier.advanced.regular)}` : ''}. STT, LLM, and TTS are all inside that number. Switch the Brain dropdown and watch the rate change.</li>}
            <li><b>Speech-to-text</b> bills per second of audio, no rounding up to a minute, so an hour of talk is: {sttRates}. Redaction adds {perHour(r.redactionPerMin)} and keyterm prompting {perHour(r.keytermPerMin)}; speaker diarization and smart formatting are included. {duet ? 'Two people talking is one stream, so two voices cost the same as one.' : 'This demo runs a second STT stream for the visible bubbles, so it pays that line twice; a production app would not.'}</li>
            {!duet && fluxTts && auraTts && <li><b>Text-to-speech</b> bills per 1,000 characters. Flux TTS is {fluxRate === 0 ? `free through ${r.promoEnds}, then $${fluxTts.regularPer1k} per 1,000` : `$${fluxRate} per 1,000`}; Aura-2 is ${auraTts.ratePer1k} per 1,000. A one-line reply is about 60 characters, so a thousand of them {fluxRate === 0 ? `will cost about ${atScale((60 / 1000) * (fluxTts.regularPer1k ?? 0))} once the promo ends` : `cost about ${atScale((60 / 1000) * fluxRate)}`}.</li>}
            <li><b>Why a thousand?</b> One panel costs a fraction of a cent, which is not a number anyone can picture. Each panel's tag shows what was metered ({duet ? 'seconds heard' : 'seconds heard for a person, characters spoken for the robot'}) and what a thousand panels like it would cost.</li>
          </ul>
          <a href={r.source} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>deepgram.com/pricing →</a>
        </div>
        <div className="row"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
