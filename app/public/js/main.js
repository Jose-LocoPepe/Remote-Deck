// Punto de entrada: arma los componentes, aplica la vista y anima los decks visibles.
import { store, connect } from './state.js';
import { prefs } from './storage.js';
import { LAYOUTS } from './layouts.js';
import { createDeck } from './components/deck.js';
import { createMixer } from './components/mixer.js';
import { createTopbar } from './components/topbar.js';
import { createHistory } from './components/history.js';
import { createQr } from './components/qr.js';
import { createRemote } from './components/remote.js';

const decks = [1, 2, 3, 4].map((id) => createDeck(store, id));
const mixer = createMixer(store);
const history = createHistory(store);
const qr = createQr();
const remote = createRemote(store, { onSettings: () => document.body.classList.toggle('show-topbar') });
const miniQ = matchMedia('(max-width: 719px), (max-height: 559px)');
miniQ.addEventListener('change', () => remote.setMini(miniQ.matches));
const stage = document.createElement('main');
stage.className = 'stage';

let layout = LAYOUTS[prefs.get('layout')] ? prefs.get('layout') : 'remote';
if (!prefs.get('rm-seen')) { prefs.set('rm-seen', '1'); prefs.set('layout', (layout = 'remote')); }
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
  onHistory: () => history.open(),
  onQr: () => qr.open(),
  onLayout(key) {
    document.body.classList.remove('show-topbar');
    prefs.set('layout', (layout = key));
    arrange();
  },
});
document.body.append(topbar.el, stage, remote.el, history.el, qr.el);
remote.setMini(miniQ.matches);

function arrange() {
  const L = LAYOUTS[layout];
  document.body.dataset.layout = layout;
  remote.el.hidden = layout !== 'remote';
  if (layout === 'remote') { visible = []; topbar.setLayout(layout); topbar.setPager([], ''); stage.replaceChildren(); remote.render(); requestAnimationFrame(remote.redraw); return; }
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
store.on('status', () => { topbar.setStatus(); remote.setStatus(!store.online ? 'off' : store.status.paired ? 'ok' : ''); });
store.on('deck', () => layout === 'remote' && remote.onDeck());
store.on('loop', () => layout === 'remote' && remote.onLoop());
store.on('deck', (id) => decks[id - 1].render());
store.on('loop', (id) => decks[id - 1].renderLoop());
store.on('mixer', mixer.render);
store.on('history', () => {
  history.render();
  for (const d of decks) d.renderPlayed();
});

// Solo se animan los decks visibles.
function frame() {
  const now = store.now();
  for (const id of visible) decks[id - 1].frame(now);
  if (layout === 'remote') remote.frame(now);
  requestAnimationFrame(frame);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { relayout(); redrawOverviews(); remote.redraw(); }, 100);
});
// iOS no recalcula aspect-ratio/cqw al girar: forzamos un relayout completo.
function relayout() { const e = remote.el; e.style.display = 'none'; void e.offsetHeight; e.style.display = ''; }
window.addEventListener('orientationchange', () => { setTimeout(relayout, 50); setTimeout(relayout, 400); });
screen.orientation?.addEventListener?.('change', () => setTimeout(relayout, 400));

// Mantener la pantalla encendida cuando se pueda.
async function wake() {
  try { await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake());
wake();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

arrange();
topbar.setStatus();
// El servidor abre el navegador del PC en /#qr al arrancar: mostrar el QR de entrada.
if (location.hash === '#qr') {
  qr.open();
  window.history.replaceState(null, '', location.pathname);
}
connect();
requestAnimationFrame(frame);
