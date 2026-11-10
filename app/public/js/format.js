// Utilidades de formato compartidas.

export function fmtTime(sec, tenths = true) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return tenths ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

export function fileName(p) {
  return (p || '').split(/[\/]/).pop() || '—';
}

// Tonalidad → Camelot (como la muestra Serato). Si ya viene en Camelot, se deja.
const CAMELOT = {
  'G#m': '1A', Abm: '1A', B: '1B', 'D#m': '2A', Ebm: '2A', 'F#': '2B', Gb: '2B',
  'A#m': '3A', Bbm: '3A', 'C#': '3B', Db: '3B', Fm: '4A', 'G#': '4B', Ab: '4B',
  Cm: '5A', 'D#': '5B', Eb: '5B', Gm: '6A', 'A#': '6B', Bb: '6B', Dm: '7A', F: '7B',
  Am: '8A', C: '8B', Em: '9A', G: '9B', Bm: '10A', D: '10B',
  'F#m': '11A', Gbm: '11A', A: '11B', 'C#m': '12A', Dbm: '12A', E: '12B',
};
export function camelot(k) {
  if (!k) return '';
  const t = k.trim().replace(/\s*min(or)?$/i, 'm').replace(/\s*maj(or)?$/i, '').replace('♯', '#').replace('♭', 'b');
  return CAMELOT[t] || k;
}

export function pitchText(rate) {
  if (!rate) return '';
  const p = (rate - 1) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}
