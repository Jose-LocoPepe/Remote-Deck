// Componente QR: muestra el código para abrir Remote Deck en otro celular.

export function createQr() {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.hidden = true;
  el.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet-panel qr-panel" role="dialog" aria-label="Conectar otro dispositivo">
      <header class="sheet-head">
        <h2>Conectar otro dispositivo</h2>
        <button class="sheet-close" data-close aria-label="Cerrar">✕</button>
      </header>
      <img class="qr-img" alt="Código QR" width="240" height="240" />
      <p class="qr-url"></p>
      <p class="qr-hint">Escanéalo con la cámara del celular. Debe estar en la misma red Wi-Fi que el computador con Serato.</p>
    </section>`;
  const img = el.querySelector('.qr-img');
  const url = el.querySelector('.qr-url');
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) el.hidden = true; });

  async function open() {
    el.hidden = false;
    img.src = `qr.svg?t=${Date.now()}`;
    try {
      const info = await (await fetch('info')).json();
      url.textContent = info.url;
    } catch {
      url.textContent = location.origin;
    }
  }

  return { el, open };
}
