/** Deepgram redaction markers, shared by the server (permalink scrub) and the browser (censor bars). */
export const REDACTION_SOURCE = String.raw`\[(?:[A-Z_]+?)_\d+\]|\[REDACTED\]|\*{3,}`;
/** Global, for replace(). */
export const REDACTION_RE = new RegExp(REDACTION_SOURCE, 'g');
/** Non-global twin for test(), since /g keeps lastIndex. */
export const hasRedaction = (text) => new RegExp(REDACTION_SOURCE).test(text);
