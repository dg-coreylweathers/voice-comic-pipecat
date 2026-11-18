/** Wall-clock time for expiry chips, e.g. "3:42 PM". */
export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
