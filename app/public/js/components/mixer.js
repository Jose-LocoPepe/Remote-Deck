// Componente Mixer: upfaders de los decks visibles + crossfader.
import { DECK_COLORS } from './deck.js';

export function createMixer(store) {
  const el = document.createElement('aside');
  el.className = 'mixer';
  el.innerHTML =
    '<div class="faders"></div><div class="xfader"><div class="rail"><div class="knob"></div></div><span>X</span></div>';
  const faders = el.querySelector('.faders');
  const knob = el.querySelector('.knob');
  let ids = [];

  function setDecks(list) {
    ids = list;
    faders.replaceChildren(
      ...ids.map((id) => {
        const f = document.createElement('div');
        f.className = 'fader';
        f.style.setProperty('--deck', DECK_COLORS[id - 1]);
        f.innerHTML = `<div class="track"><div class="fill"></div></div><span class="ch">${id}</span>`;
        return f;
      }),
    );
    render();
  }

  function render() {
    [...faders.children].forEach((f, i) => {
      const v = store.mixer.upfaders[ids[i] - 1];
      f.style.setProperty('--v', v == null ? 0 : Math.max(0, Math.min(1, v)));
    });
    const x = store.mixer.crossfader;
    knob.style.left = `${(x == null ? 0.5 : Math.max(0, Math.min(1, x))) * 100}%`;
  }

  return { el, setDecks, render };
}
