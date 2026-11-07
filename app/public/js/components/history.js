// Componente Historial: pistas que ya sonaron en el set, con buscador.
// Pensado para responder rápido "¿ya toqué esta?" en pleno set.

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const hhmm = (t) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createHistory(store) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.hidden = true;
  el.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet-panel" role="dialog" aria-label="Historial del set">
      <header class="sheet-head">
        <h2>Historial del set <span class="count"></span></h2>
        <a class="sheet-action" href="history.txt" download title="Descargar tracklist">⤓ Tracklist</a>
        <button class="sheet-close" data-close aria-label="Cerrar">✕</button>
      </header>
      <label class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l5 5-1.4 1.4-5-5A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>
        <input type="search" placeholder="¿Ya la toqué? Busca artista o título…" autocomplete="off" />
      </label>
      <div class="verdict" hidden></div>
      <ol class="hist-list"></ol>
    </section>`;
  const input = el.querySelector('input');
  const list = el.querySelector('.hist-list');
  const count = el.querySelector('.count');
  const verdict = el.querySelector('.verdict');

  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  input.addEventListener('input', render);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) close(); });

  function open() {
    el.hidden = false;
    render();
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    el.hidden = true;
    input.value = '';
  }

  function render() {
    if (el.hidden) return;
    const all = store.history;
    count.textContent = all.length ? `· ${all.length}` : '';
    const terms = norm(input.value).split(/\s+/).filter(Boolean);
    const rows = all
      .map((h, i) => ({ ...h, n: i + 1 }))
      .filter((h) => terms.every((t) => norm(`${h.artist} ${h.title}`).includes(t)))
      .reverse(); // lo más reciente arriba
    if (terms.length) {
      verdict.hidden = false;
      verdict.className = `verdict ${rows.length ? 'yes' : 'no'}`;
      verdict.textContent = rows.length
        ? `✓ Sí, ya sonó${rows.length > 1 ? ` ${rows.length} veces` : ''} — última a las ${hhmm(rows[0].at)}`
        : '✗ No ha sonado en este set';
    } else {
      verdict.hidden = true;
    }
    list.innerHTML = rows.length
      ? rows.map((h) => `
          <li>
            <span class="hn">${h.n}</span>
            <span class="ht"><b>${esc(h.title)}</b><small>${esc(h.artist)}</small></span>
            <span class="hm">${hhmm(h.at)}<small>Deck ${h.deck}</small></span>
          </li>`).join('')
      : `<li class="empty">${all.length ? 'Sin coincidencias' : 'Todavía no suena ninguna pista. Una pista cuenta tras 15 s sonando.'}</li>`;
  }

  return { el, open, close, render };
}
