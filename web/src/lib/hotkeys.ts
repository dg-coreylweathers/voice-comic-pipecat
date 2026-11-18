/** Operator hotkeys, in one place so the handler, the idle-screen hint and the presenter notes agree. Ignored while typing in a field. */
export type HotkeyId = 'xray' | 'redact' | 'booth' | 'wipe' | 'stop' | 'pause' | 'reset' | 'mode' | 'duet';
export const HOTKEYS: { id: HotkeyId; key: string; label: string; show?: string }[] = [
  { id: 'pause', key: ' ', label: 'pause / resume', show: 'space' },
  { id: 'reset', key: 'n', label: 'new conversation' },
  { id: 'mode', key: 'm', label: 'next mode' },
  { id: 'duet', key: 'd', label: 'two people ⇄ Flux chat' },
  { id: 'xray', key: 'x', label: 'X-ray' },
  { id: 'redact', key: 'r', label: 'Redact' },
  { id: 'booth', key: 'b', label: 'Booth mode' },
  { id: 'wipe', key: 'w', label: 'Wipe strip' },
  { id: 'stop', key: 'Escape', label: 'stop', show: 'Esc' },
];
export const hotkeyFor = (key: string) => HOTKEYS.find((h) => h.key === key)?.id;

/** One sentence for the toolbar title and the toast. */
export const BOOTH_BLURB = 'redaction on, no audio stored, saved strips trimmed and expiring';
