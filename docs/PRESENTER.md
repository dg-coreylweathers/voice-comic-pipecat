# Voice Comic: 90-second booth walkthrough

Open https://dg-voice-comic.fly.dev on the booth screen. Leave it on the idle screen between visitors: the attract loop shows the four beats every ten seconds and pulls people in. Keep the room-facing monitor on the strip and your laptop on the same page with **X-ray** open if you want the wire.

## Pick a scene first

The **Scene** dropdown (or `d`) picks the pipeline. The hero screen offers both as buttons.

| Scene | What runs | When |
| --- | --- | --- |
| Flux chat (Talk to Flux) | Voice Agent API: Flux STT → Claude → Flux TTS, plus the transcript layer | One visitor talks with the robot |
| Two people | Nova-3 only, with speaker diarization. No agent, no TTS, no LLM | Two visitors (or you and a visitor) talk to each other and get drawn |

In **Two people** the second voice gets the beanie, a SPEAKER 2 badge and the right-hand column where the robot usually is, and every hand-off is labelled **new voice**. The cost chip shows Nova-3 minutes only; diarization is included in the price, which the cost modal says out loud. Say "wait, it can tell us apart?" and let the strip answer.

Streaming diarization needs a warm-up: the first few exchanges often land on one speaker while Nova-3 learns both voices, then the chip flips from **learning your voices…** to **Nova-3 told 2 voices apart** and the hand-offs start splitting. Have each person say two or three full sentences before you point at it, and stand a little apart from the mic.

## Pick a mode (Flux chat only)

The **Mode** dropdown (or `m` to cycle) tells Flux who is at the mic. Switching mid-conversation is fine; it re-prompts the agent live.

| Mode | When | What Flux does | Badge on the panels |
| --- | --- | --- | --- |
| Showcase · presenter | You are soloing the pitch | Narrates the Deepgram feature that just happened (turn ended on its own, barge-in, redaction, model switch) | STAFF |
| Visitor chat | A visitor takes the mic | Playful sidekick, one or two sentences | VISITOR |
| Q&A about Deepgram | Visitors ask product questions | Answers from a fact sheet (models, pricing tiers, SDKs, self-hosted) and says when it does not know | VISITOR |

Two people at the mic but you still want Flux to answer? Tick **Two speakers**. The transcript layer switches to Nova-3 with diarization and each speaker gets their own panels: the second speaker is drawn in a beanie with a VISITOR 2 badge (VISITOR next to STAFF in showcase mode). Flux still hears one conversation, so hand-offs work best when one person talks at a time. If nobody needs the robot, use the **Two people** scene instead.

## Transport

The status pill next to the buttons always says what the mic is doing: IDLE, LIVE, PAUSED, STOPPED.

- **Start / Continue.** Opens the mic. Continue picks up the same strip after a Stop.
- **Pause / Resume** (`space`). Mutes the mic and keeps the connection warm, so resuming is instant. The Voice Agent still bills the connection minutes while paused; the cost chip keeps counting on purpose.
- **Stop** (`Esc`). Closes the mic and the connection. The strip stays.
- **New chat** (`n`). Flux forgets the context and greets again; the strip keeps going with a NEW CONVERSATION divider. Use it between visitors. In the Two people scene it just draws the divider.
- **Strip** (new strip) / **`w`**. Clears everything. `w` is instant and says whether anything had been saved.

## The script

**0:00 to 0:15. Hook.** Point at the attract loop.
"This is a comic strip that draws itself while you talk. Every panel you see is a Deepgram model doing something. Want to be in it?"
Press **Start talking**. Read the consent line out loud if they hesitate: nothing is stored unless someone presses Save.

**0:15 to 0:40. Talk and interrupt.** Have the visitor say anything. Point at the bubble filling word by word.
"Flux is hearing you right now, and it decided your turn was over on its own. No push-to-talk."
When Flux starts answering, tell them to interrupt it mid-sentence. The bubble tears, the words get struck through, and the panel says **you interrupted**.
"That is barge-in. Flux TTS stopped and the strip kept the evidence."

**0:40 to 1:00. Redact and switch.** Press **r** (or tick Redact). Ask them to say a fake phone number.
"Now a second model, Nova-3, is listening to the same microphone with redaction on. The digits never reach the page, so the panel says **redacted** and **switched to Nova-3**."
Flip the Voice dropdown to Aura-2. Flux's next panel is tagged **switched to Aura-2**.
"You can swap models mid-conversation. Flux is still the default; the rest are one dropdown away."

**1:00 to 1:20. Show the wire.** Press **x**.
"Everything on the left is drawn from these events: TurnInfo for the bubble, LatencyReport for the reply time on the panel, the read API for the mood. And the cost chip is the real meter, per minute, per model."
Tap the cost chip if they ask about money. It reads in whole cents and m:ss, and the breakdown leads with what an hour of this costs and what a thousand conversations this long would cost (the number to say out loud: "about three and a half dollars an hour, all in"). Under that, two bars, one scale: Voice Agent bundle versus a la carte, both following the models currently selected (the Brain dropdown moves the tier rate, the Voice dropdown the TTS line). Promo rates flip to regular after 9/14 by themselves. Panel tags show seconds heard or characters spoken and what a thousand such panels cost, because one panel is a fraction of a cent.

**1:20 to 1:30. Send them off.** Press **Save & share**. A QR code appears.
"Scan it and the strip replays on your phone with the recording. The code is on GitHub, link is in the corner."

## What to point at

| Visitor sees | Say | Model behind it |
| --- | --- | --- |
| Bubble filling live, then closing | "It decided your turn was over" | Flux STT turn detection |
| Struck-through robot text, **you interrupted** | "Barge-in, kept as evidence" | Flux TTS + agent UserStartedSpeaking |
| Black bars, **redacted** | "Nova-3 hid it before it reached the page" | Nova-3 `redact=pii,pci,numbers` |
| Yellow or blue panel, happy or upset face | "Text Intelligence read the mood" | `/v1/read` sentiment |
| **replied in 0.5s** | "That is the real round trip" | LatencyReport |
| **switched to Nova-3**, **switched to Aura-2** | "Swapped mid-conversation" (a Flux-to-Flux voice change stays quiet) | Redact toggle, UpdateListen / UpdateSpeak |
| Beanie speaker on the right, **new voice**, SPEAKER 2 | "Nova-3 tells your voices apart, one stream" | Nova-3 `diarize=true` (Two people scene) |

## Hotkeys

- **space** Pause and resume the mic
- **n** New conversation (Flux forgets, strip keeps going)
- **m** Next mode (Visitor chat, Showcase, Q&A)
- **d** Switch scene: Two people ⇄ Flux chat (reconnects, keeps the strip and the meter)
- **x** X-ray on and off
- **r** Redact on and off
- **b** Booth mode on and off (redaction on, no audio stored, short transcript expiry)
- **w** Wipe the current strip instantly (the strip disappears, nothing is saved)
- **Esc** Stop the microphone

## After the event: what people talked about

Every finished visitor turn already goes through Text Intelligence; the server tallies its topics and intents plus a small booth taxonomy (pricing, latency, languages, self-hosted, SDKs, competitors, security) per event and per day. Only terms and counts are kept, never the words, and topics that look like a person or company are filtered out.

- **On the booth screen:** the **Themes** button (or `/themes`) shows a live word cloud sized by how often a topic came up and coloured by mood, with bars for the taxonomy. It refreshes every ten seconds and exports as PNG.
- **Afterwards:** `https://dg-voice-comic.fly.dev/api/themes.csv` downloads the tally (one row per event, day, kind, term). Set `EVENT_NAME` on the deployment per event so re:Invent and AGNTCon do not blend; `/api/themes?event=...` and the dropdown on `/themes` switch between them.

## When it goes wrong

- **Too loud to be heard.** Type a line in the toolbar box while live. It draws a visitor panel immediately and goes to the agent as `InjectUserMessage`.
- **No reply after a model switch.** Switching Flux to Nova mid-conversation sometimes gets no acknowledgement. The app waits three seconds and reconnects quietly. Keep talking.
- **Someone said something they should not have.** Press **w**. The strip is gone from the screen and was never stored. If it was saved, ask for the link and delete it from the volume, or wait for the booth expiry.
- **Mic permission denied.** Reload and press Start again. The mic is requested before any Deepgram socket opens, so nothing is billed.
- **Show the cast.** `/cast` shows both characters in all six expressions if someone asks how the faces work.
