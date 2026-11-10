// Envía controles a Serato vía el servidor (/control → /Control/ACI).
// En cola y en orden: el "soltar" nunca llega antes que el "presionar".
let queue = Promise.resolve();

export function control(deck, name, value, prop = 0) {
  queue = queue
    .then(() => fetch('control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck, name, value, prop }),
    }))
    .catch(() => {})
    .then(() => (value === 0 ? null : new Promise((r) => setTimeout(r, 60))));
}

export function haptic() {
  try { navigator.vibrate?.(10); } catch {}
}
