// Componente Topbar: selector de decks, menú de vistas, historial, QR y estado.
import { LAYOUTS } from '../layouts.js';

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON_SEARCH = 'M10 3a7 7 0 0 1 5.6 11.2l5 5-1.4 1.4-5-5A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z';
const ICON_QR = 'M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm3 3h3v3h-3zm-3 3h3v3h-3zm6-6h2v3h-2zm0 6h2v2h-2z';

export function createTopbar(store, { onPage, onLayout, onHistory, onQr }) {
  const el = document.createElement('header');
  el.className = 'topbar';
  const items = Object.entries(LAYOUTS)
    .map(
      ([k, l]) =>
        `<button role="menuitemradio" data-layout="${k}">${svg(l.icon)}<span><b>${l.label}</b><small>${l.hint}</small></span></button>`,
    )
    .join('');
  el.innerHTML = `
    <div class="brand"><span class="logo"></span><span class="brand-name">Remote Deck</span></div>
    <div class="pager" role="tablist"></div>
    <div class="views">
      <button class="view-btn" aria-haspopup="menu" aria-expanded="false" title="Cambiar vista"></button>
      <div class="view-menu" role="menu" hidden>${items}</div>
    </div>
    <button class="icon-btn hist-btn" title="Historial del set (¿ya la toqué?)" aria-label="Historial">${svg(ICON_SEARCH)}</button>
    <button class="icon-btn qr-btn" title="Conectar otro dispositivo (QR)" aria-label="Código QR">${svg(ICON_QR)}</button>
    <div class="conn"><span class="dot"></span><span class="label">Conectando…</span></div>`;
  const pager = el.querySelector('.pager');
  const btn = el.querySelector('.view-btn');
  const menu = el.querySelector('.view-menu');
  const conn = el.querySelector('.conn');

  el.querySelector('.hist-btn').addEventListener('click', () => onHistory());
  el.querySelector('.qr-btn').addEventListener('click', () => onQr());
  pager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (b) onPage(b.dataset.page);
  });
  const toggleMenu = (open = menu.hidden) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    onLayout(b.dataset.layout);
    toggleMenu(false);
  });
  document.addEventListener('click', (e) => {
    if (!el.contains(e.target)) toggleMenu(false);
  });

  function setPager(options, current) {
    pager.hidden = options.length < 2;
    pager.replaceChildren(
      ...options.map(([value, label]) => {
        const b = document.createElement('button');
        b.className = 'page' + (value === current ? ' on' : '');
        b.dataset.page = value;
        b.textContent = label;
        return b;
      }),
    );
  }

  function setLayout(key) {
    const l = LAYOUTS[key];
    btn.innerHTML = `${svg(l.icon)}<span>${l.label}</span>`;
    for (const b of menu.querySelectorAll('[data-layout]')) {
      b.setAttribute('aria-checked', String(b.dataset.layout === key));
    }
  }

  function setStatus() {
    const st = store.status;
    let cls = 'wait';
    let text = 'Iniciando…';
    if (!store.online) {
      cls = 'off';
      text = 'Sin servidor';
    } else if (st.paired) {
      cls = 'ok';
      text = st.peerName || 'Serato';
    } else if (st.advertising) {
      text = 'Esperando a Serato…';
    }
    conn.className = `conn ${cls}`;
    conn.querySelector('.label').textContent = text;
  }

  return { el, setPager, setLayout, setStatus };
}
