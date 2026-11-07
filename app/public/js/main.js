// Punto de entrada: arma los componentes, aplica la vista y anima los decks visibles.
import { store, connect } from './state.js';
import { prefs } from './storage.js';
import { LAYOUTS } from './layouts.js';
import { createDeck } from './components/deck.js';
import { createMixer } from './components/mixer.js';
import { createTopbar } from './components/topbar.js';

const decks = [1, 2, 3, 4].map((id) => createDeck(store, id));
const mixer = createMixer(store);
const stage = document.createElement('main');
stage.className = 'stage';

let layout = LAYOUTS[prefs.get('layout')] ? prefs.get('layout') : 'classic';
let page = prefs.get('page', '12'); // vistas de 2 decks: "12" o "34"
let single = prefs.get('single', '1'); // vista de 1 deck: "1".."4"
let visible = [];
const portrait = matchMedia('(max-aspect-ratio: 1/1)');
portrait.addEventListener('change', () => arrange());

const topbar = createTopbar(store, {
  onPage(value) {
    if (LAYOUTS[layout].count === 1) prefs.set('single', (single = value));
    else prefs.set('page', (page = value));
    arrange();
  },
  onLayout(key) {
    prefs.set('layout', (layout = key));
    arrange();
  },
});
document.body.append(topbar.el, stage);

function arrange() {
  const L = LAYOUTS[layout];
  document.body.dataset.layout = layout;
  topbar.setLayout(layout);
  if (L.count === 4) {
    visible = [1, 2, 3, 4];
    topbar.setPager([], '');
  } else if (L.count === 1) {
    visible = [Number(single)];
    topbar.setPager([['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], single);
  } else {
    visible = page.split('').map(Number);
    topbar.setPager([['12', '1 · 2'], ['34', '3 · 4']], page);
  }
  const els = visible.map((id) => decks[id - 1].el);
  if (L.mixer) {
    els.splice(1, 0, mixer.el);
    mixer.setDecks(visible);
    // Mixer como barra horizontal en la vista Horizontal y en la Clásica en vertical.
    mixer.el.classList.toggle('row', layout === 'horizontal' || portrait.matches);
  }
  stage.replaceChildren(...els);
  for (const id of visible) decks[id - 1].render();
  requestAnimationFrame(redrawOverviews);
}

function redrawOverviews() {
  for (const id of visible) decks[id - 1].drawOverview();
}

store.on('snapshot', arrange);
store.on('status', topbar.setStatus);
store.on('deck', (id) => decks[id - 1].render());
store.on('loop', (id) => decks[id - 1].renderLoop());
store.on('mixer', mixer.render);

// Solo se animan los decks visibles.
function frame() {
  const now = store.now();
  for (const id of visible) decks[id - 1].frame(now);
  requestAnimationFrame(frame);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(redrawOverviews, 100);
});

// Mantener la pantalla encendida cuando se pueda.
async function wake() {
  try { await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake());
wake();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

arrange();
topbar.setStatus();
connect();
requestAnimationFrame(frame);
