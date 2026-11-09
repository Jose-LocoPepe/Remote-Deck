// Componente Mixer: upfaders de los decks visibles + crossfader (táctiles).
import { DECK_COLORS } from './deck.js';

// Envío "el último gana": un solo POST en vuelo por control, sin la cola de pads.
const pending = new Map();
const inflight = new Set();
function sendValue(key, body) {
  pending.set(key, body);
  if (inflight.has(key)) return;
  inflight.add(key);
  (function next() {
    const b = pending.get(key);
    if (!b) return inflight.delete(key);
    pending.delete(key);
    fetch('control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .catch(() => {}).then(next);
  })();
}

const clamp = (v) => Math.max(0, Math.min(1, v));

// Arrastre sobre un elemento; onValue recibe 0..1.
function drag(target, getValue, onValue, onEnd) {
  target.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    const move = (ev) => onValue(clamp(getValue(ev)));
    move(e);
    const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); onEnd(); };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  });
}

export function createMixer(store) {
  const el = document.createElement('aside');
  el.className = 'mixer';
  el.innerHTML =
    '<div class="faders"></div><div class="xfader"><div class="rail"><div class="knob"></div></div><span>X</span></div>';
  const faders = el.querySelector('.faders');
  const rail = el.querySelector('.rail');
  const knob = el.querySelector('.knob');
  let ids = [];
  const touching = new Set(); // mientras se arrastra, ignora el eco de Serato

  function setDecks(list) {
    ids = list;
    faders.replaceChildren(
      ...ids.map((id) => {
        const f = document.createElement('div');
        f.className = 'fader';
        f.style.setProperty('--deck', DECK_COLORS[id - 1]);
        f.innerHTML = `<div class="track"><div class="fill"></div></div><span class="ch">${id}</span>`;
        const track = f.querySelector('.track');
        drag(track, (ev) => {
          const r = track.getBoundingClientRect();
          return el.classList.contains('row') ? (ev.clientX - r.left) / r.width : (r.bottom - ev.clientY) / r.height;
        }, (v) => {
          touching.add('u' + id);
          store.mixer.upfaders[id - 1] = v;
          f.style.setProperty('--v', v);
          sendValue('u' + id, { deck: id, name: 'upfader', value: v, prop: 0 });
        }, () => touching.delete('u' + id));
        return f;
      }),
    );
    render();
  }

  drag(rail, (ev) => {
    const r = rail.getBoundingClientRect();
    return (ev.clientX - r.left) / r.width;
  }, (v) => {
    touching.add('x');
    store.mixer.crossfader = v;
    knob.style.left = `${v * 100}%`;
    sendValue('x', { deck: 1, name: 'crossfader', value: v, prop: 0 });
  }, () => touching.delete('x'));

  function render() {
    [...faders.children].forEach((f, i) => {
      if (touching.has('u' + ids[i])) return;
      const v = store.mixer.upfaders[ids[i] - 1];
      f.style.setProperty('--v', v == null ? 0 : clamp(v));
    });
    if (touching.has('x')) return;
    const x = store.mixer.crossfader;
    knob.style.left = `${(x == null ? 0.5 : clamp(x)) * 100}%`;
  }

  return { el, setDecks, render };
}
