// Estado compartido + conexión SSE con el servidor.
// Los componentes se suscriben a eventos concretos en vez de redibujar todo.

export const store = {
  decks: [1, 2, 3, 4].map((id) => ({ id, track: null, meta: null, pos: 0, rate: 0, bpm: 0, t: 0, loop: {} })),
  mixer: { crossfader: null, upfaders: [] },
  history: [], // [{ at, deck, title, artist, filePath }]
  status: { advertising: false, paired: false, peerName: '' },
  online: false,
  clockSkew: 0, // tiempo servidor − tiempo cliente
  listeners: new Map(),
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  },
  emit(type, payload) {
    for (const fn of this.listeners.get(type) || []) fn(payload);
  },
  now() { return Date.now() + this.clockSkew; },
  /** Posición interpolada entre mensajes del servidor. */
  positionOf(d, now = this.now()) {
    return d.rate > 0.001 ? d.pos + (d.rate * (now - d.t)) / 1000 : d.pos;
  },
};

export function connect() {
  const es = new EventSource('events');
  const on = (type, fn) => es.addEventListener(type, (e) => fn(JSON.parse(e.data)));
  on('snapshot', (snap) => {
    store.clockSkew = snap.t - Date.now();
    snap.decks.forEach((d, i) => Object.assign(store.decks[i], d, { t: snap.t }));
    store.mixer = snap.mixer;
    store.status = snap.status;
    store.history = snap.history || [];
    store.online = true;
    store.emit('snapshot');
    store.emit('status', store.status);
  });
  on('status', (st) => { store.status = st; store.emit('status', st); });
  on('deck', (d) => {
    Object.assign(store.decks[d.id - 1], { track: d.track, meta: d.meta, loop: d.loop, loadedAt: d.loadedAt });
    store.emit('deck', d.id);
  });
  on('playhead', (p) => {
    Object.assign(store.decks[p.id - 1], { pos: p.pos, rate: p.rate, bpm: p.bpm, t: p.t });
  });
  on('loop', (p) => { store.decks[p.id - 1].loop = p.loop; store.emit('loop', p.id); });
  on('history', (h) => { store.history = h; store.emit('history'); });
  on('mixer', (m) => { store.mixer = m; store.emit('mixer'); });
  es.onerror = () => { store.online = false; store.emit('status', store.status); };
}
