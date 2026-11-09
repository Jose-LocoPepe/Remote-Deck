// Vista "Remote": diseño al estilo del Serato Remote clásico.
//  · Ancha (tablet / horizontal): decks arriba (dial + PLAY/SYNC), pestañas abajo.
//  · Mini (celular): pestañas LIB · PADS · SP6 · FX a pantalla completa.
import { fmtTime } from '../format.js';
import { control, haptic } from '../control.js';
import { prefs } from '../storage.js';

const LOOP_SIZES = ['1/32', '1/16', '1/8', '1/4', '1/2', '1', '2', '4', '8', '16', '32'];
const beatsOf = (idx) => 2 ** (idx - 5);
const CUE_DEFAULT = ['#cc2a2a', '#e8892b', '#1a4fa8', '#f2d300', '#2f9a3f', '#9b3fb0', '#2bb5b5', '#d64fa0'];
const RING = 2 * Math.PI * 46;
const sizeLabel = (idx) => {
  const s = LOOP_SIZES[idx];
  return s.includes('/') ? `<span class="frac"><i>1</i><i>${s.split('/')[1]}</i></span>` : `<b>${s}</b>`;
};

// Envío continuo "el último gana" (faders), sin la cola de pads.
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

function dialHTML(side) {
  return `
  <div class="rm-dial ${side}">
    <svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="46"/><circle class="prog" cx="50" cy="50" r="46"/></svg>
    <div class="needle"><i></i></div>
    <div class="hub"></div>
    <div class="bpm"><b>—</b><small></small></div>
    <div class="times"><div class="el">00 00 0</div><div class="rem">00 00 0</div></div>
  </div>`;
}

function deckSide(side) {
  return `<div class="rm-side ${side}">
    <button class="rm-btn play" data-a="play"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg></button>
    <button class="rm-btn sync" data-a="sync">SYNC</button>
    <button class="rm-btn off" data-a="syncoff">OFF</button>
  </div>`;
}

export function createRemote(store, { onSettings }) {
  const el = document.createElement('main');
  el.className = 'rm';
  el.innerHTML = `
    <section class="rm-decks">
      ${deckSide('l')}
      <div class="rm-mid">
        <div class="rm-strips"><canvas class="ov l"></canvas><span class="rm-brand">REMOTE DECK</span><canvas class="ov r"></canvas></div>
        <div class="rm-dials">
          ${dialHTML('l')}
          <div class="rm-center">
            <div class="rm-small"><button class="rm-chip" data-a="tab" title="Cambiar decks 1·2 / 3·4">TAB</button></div>
            <div class="rm-browse">
              <button class="arr up" data-a="up" title="Subir en la biblioteca (β)"></button>
              <button class="disc" data-a="load" title="Cargar la pista seleccionada (β)"><i></i></button>
              <button class="arr down" data-a="down" title="Bajar en la biblioteca (β)"></button>
            </div>
          </div>
          ${dialHTML('r')}
        </div>
        <div class="rm-playbars"><button class="pb l" data-a="play"></button><button class="pb r" data-a="play"></button></div>
      </div>
      ${deckSide('r')}
    </section>
    <nav class="rm-tabs">
      <button class="rm-collapse" title="Ocultar / mostrar decks"><svg viewBox="0 0 24 24"><path d="M12 5l7 8h-4v6H9v-6H5z"/></svg></button>
      <button class="tab lib" data-tab="lib">LIB</button>
      <button class="tab" data-tab="pads">PADS</button>
      <button class="tab" data-tab="sampler"><span class="wide">SAMPLER</span><span class="mini">SP6</span></button>
      <button class="tab" data-tab="fx">FX</button>
      <button class="rm-gear" title="Ajustes, vistas, historial y QR"><svg viewBox="0 0 24 24"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg><span class="conn-dot"></span></button>
    </nav>
    <section class="rm-panel"></section>`;
  const q = (s) => el.querySelector(s);
  const panel = q('.rm-panel');
  const dials = { l: q('.rm-dial.l'), r: q('.rm-dial.r') };
  const sides = { l: q('.rm-side.l'), r: q('.rm-side.r') };
  const strips = { l: q('.ov.l'), r: q('.ov.r') };
  const playbars = { l: q('.pb.l'), r: q('.pb.r') };

  let page = prefs.get('page', '12');
  let tab = prefs.get('rm-tab', 'pads');
  let collapsed = false;
  let mini = false;
  let padDeck = prefs.get('rm-paddeck', 'l'); // mini: deck de los pads
  let miniLoops = false;
  let rollMode = false;
  let deleteMode = false;
  let quant = true;
  const loopIdx = { l: 5, r: 7 };
  const sync = { 1: false, 2: false, 3: false, 4: false };
  let bank = 0;
  let spVol = 1;
  const fx = { 1: { on: false, latch: false, depth: 0.5, beats: 2 }, 2: { on: false, latch: false, depth: 0.5, beats: 2 } };

  const ids = () => ({ l: Number(page[0]), r: Number(page[1]) });
  const deckOf = (side) => store.decks[ids()[side] - 1];

  // ── Paneles ──
  function padGrid(side) {
    const d = deckOf(side);
    const cues = d.meta?.cues || [];
    let h = '';
    for (let i = 0; i < 8; i++) {
      const c = cues.find((x) => x.index === i);
      h += c
        ? `<button class="pad cue set" data-side="${side}" data-i="${i}" style="--c:${c.color || CUE_DEFAULT[i]}">${c.name ? `<span>${esc(c.name)}</span>` : ''}</button>`
        : `<button class="pad cue empty" data-side="${side}" data-i="${i}"><span class="plus">+</span></button>`;
    }
    return `<div class="grid8">${h}</div>`;
  }
  function autoLoop(side) {
    const d = deckOf(side);
    const on = rollMode ? false : !!(d.loop.autoLoopOn && d.loop.beatLength === beatsOf(loopIdx[side]));
    return `<div class="autoloop">
      <button class="tri left" data-a="loopdn" data-side="${side}"></button>
      <button class="rm-btn big loopbtn${on ? ' on' : ''}" data-a="${rollMode ? '' : 'autoloop'}" data-hold="${rollMode ? 'roll' : ''}" data-side="${side}">
        <small>AUTO</small>${sizeLabel(loopIdx[side])}<small>${rollMode ? 'ROLL' : 'LOOP'}</small></button>
      <button class="tri right" data-a="loopup" data-side="${side}"></button>
    </div>`;
  }
  function loopStrip(side) {
    const d = deckOf(side);
    let h = '';
    for (let i = 0; i <= 6; i++) {
      const on = d.loop.autoLoopOn && d.loop.beatLength === beatsOf(i);
      h += `<button class="cell${on ? ' on' : ''}" data-a="loopsize" data-side="${side}" data-i="${i}">${sizeLabel(i)}</button>`;
    }
    return `<div class="loopstrip">${h}</div>`;
  }
  const lrToggle = () =>
    `<div class="rm-toggle" data-a="lr"><span class="${rollMode ? '' : 'on'}">LOOP</span><span class="${rollMode ? 'on' : ''}">ROLL</span></div>`;

  function renderPads() {
    if (mini) {
      panel.innerHTML = `<div class="mini-pads">
        <div class="vtabs l">
          <button class="vtab${!miniLoops && padDeck === 'l' ? ' on' : ''}" data-a="pd" data-side="l">${sideName('l')}</button>
          <button class="vtab${miniLoops ? ' on' : ''}" data-a="miniloops">LOOPS</button>
        </div>
        <div class="mini-body">${miniLoops
          ? `${autoLoop(padDeck)}${loopStrip(padDeck)}${lrToggle()}`
          : padGrid(padDeck)}</div>
        <div class="vtabs r">
          <button class="vtab${!miniLoops && padDeck === 'r' ? ' on' : ''}" data-a="pd" data-side="r">${sideName('r')}</button>
          <button class="xbtn${deleteMode ? ' on' : ''}" data-a="del">✕</button>
        </div>
      </div>`;
      return;
    }
    panel.innerHTML = `<div class="wide-pads">
      <div class="row-top">${autoLoop('l')}${lrToggle()}${autoLoop('r')}</div>
      <div class="row-grid">
        ${padGrid('l')}
        <div class="qx"><button class="qbtn${quant ? ' on' : ''}" data-a="q" title="Quantize (β)">Q</button><button class="xbtn${deleteMode ? ' on' : ''}" data-a="del" title="Borrar hot cue: toca ✕ y luego el pad">✕</button></div>
        ${padGrid('r')}
      </div></div>`;
  }
  const sideName = (side) => (mini ? (side === 'l' ? 'LEFT' : 'RIGHT') : '') + ` <b>${ids()[side]}</b>`;

  function renderSampler() {
    const slots = Array.from({ length: 6 }, (_, i) => {
      const s = bank * 6 + i;
      return `<button class="pad slot" data-a="slot" data-i="${s}"><span>${String.fromCharCode(65 + bank)}${i + 1}</span></button>`;
    }).join('');
    panel.innerHTML = `<div class="sampler">
      <div class="sp-left"><div class="vfader" data-a="spvol"><i style="height:${spVol * 100}%"></i></div><button class="rm-btn stop" data-a="spstop">STOP</button></div>
      <div class="sp-grid">${slots}</div>
      ${mini ? '' : `<div class="sp-banks">${['A', 'B', 'C', 'D'].map((b, i) => `<button class="rm-btn bank${i === bank ? ' on' : ''}" data-a="bank" data-i="${i}">${b}</button>`).join('')}</div>`}
    </div>`;
  }

  function fxUnit(n) {
    const u = fx[n];
    const marks = ['1/8', '1/4', '1/2', '1', '2'].map((m, i) => `<span style="left:${(i + 1) * (100 / 6)}%">${m.includes('/') ? `<span class="frac"><i>1</i><i>${m.split('/')[1]}</i></span>` : `<b>${m}</b>`}</span>`).join('');
    return `<div class="fx-unit${u.on ? ' on' : ''}" data-n="${n}">
      <div class="fx-head"><b class="fx-num">${n}</b><button class="fx-name">FX ${n}</button></div>
      <div class="fx-pad" data-a="fxpad" data-n="${n}"><div class="fill" style="height:${u.depth * 100}%"></div>${marks}</div>
      <div class="fx-btns">
        <div class="rm-toggle v" data-a="latch" data-n="${n}"><span class="${u.latch ? '' : 'on'}">TEMP</span><span class="${u.latch ? 'on' : ''}">LATCH</span></div>
        <div class="beats"><small>BEATS</small><div class="beatsel"><button data-a="beatdn" data-n="${n}">‹</button><b>${u.beats}</b><button data-a="beatup" data-n="${n}">›</button></div></div>
      </div>
    </div>`;
  }
  function renderFx() {
    panel.innerHTML = `<div class="fx">${fxUnit(1)}${fxUnit(2)}<p class="beta">FX en prueba (β): puede que Serato no responda todavía.</p></div>`;
  }

  function renderPanel() {
    el.dataset.tab = tab;
    for (const b of el.querySelectorAll('.rm-tabs .tab')) b.classList.toggle('on', b.dataset.tab === tab);
    if (tab === 'pads') renderPads();
    else if (tab === 'sampler') renderSampler();
    else if (tab === 'fx') renderFx();
    else panel.innerHTML = '';
  }

  // ── Decks (arriba) ──
  function renderDecks() {
    for (const side of ['l', 'r']) {
      const id = ids()[side];
      const d = deckOf(side);
      el.style.setProperty(`--deck-${side}`, d.meta?.color || (side === 'l' ? '#cc2a2a' : '#f2a516'));
      sides[side].querySelector('.sync').classList.toggle('on', sync[id]);
      dials[side].classList.toggle('sync', sync[id]);
      dials[side].dataset.id = id;
      drawStrip(side);
    }
  }

  function drawStrip(side) {
    const cv = strips[side];
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
    const d = deckOf(side);
    const peaks = d.meta?.overview;
    if (peaks?.length) {
      const bw = w / peaks.length;
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#3b8f3e'); grad.addColorStop(0.35, '#c05050'); grad.addColorStop(0.7, '#8a4fb0'); grad.addColorStop(1, '#c04040');
      g.fillStyle = grad;
      for (let i = 0; i < peaks.length; i++) {
        const ph = Math.max(1, peaks[i] * (h - 8));
        g.fillRect(i * bw, (h - ph) / 2, Math.max(1, bw - 0.3), ph);
      }
    }
    const dur = d.meta?.duration;
    if (dur) for (const c of d.meta.cues || []) {
      const x = (c.pos / dur) * w;
      g.fillStyle = c.color || CUE_DEFAULT[c.index] || '#fff';
      g.beginPath(); g.moveTo(x - 5, h); g.lineTo(x + 5, h); g.lineTo(x, h - 8); g.fill();
    }
  }

  const two = (n) => String(n).padStart(2, '0');
  const digits = (sec) => {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), t = Math.floor((sec * 10) % 10);
    return `${two(m)}<span>${two(s)}${t}</span>`;
  };

  let lastPlay = {};
  function frame(now) {
    for (const side of ['l', 'r']) {
      const d = deckOf(side);
      const dial = dials[side];
      const pos = store.positionOf(d, now);
      const dur = d.meta?.duration || 0;
      const playing = d.rate > 0.001;
      if (lastPlay[side] !== playing) {
        lastPlay[side] = playing;
        sides[side].querySelector('.play').classList.toggle('on', playing);
        playbars[side].classList.toggle('on', playing);
      }
      const frac = dur ? Math.max(0, Math.min(1, pos / dur)) : 0;
      dial.querySelector('.prog').style.strokeDashoffset = RING * frac;
      dial.querySelector('.needle').style.transform = `rotate(${((pos / 1.8) * 360) % 360}deg)`;
      const bpm = d.track && d.bpm ? d.bpm : 0;
      const b = dial.querySelector('.bpm');
      b.firstChild.textContent = bpm ? Math.floor(bpm) : '—';
      b.lastChild.textContent = bpm ? Math.floor((bpm * 10) % 10) : '';
      dial.querySelector('.el').innerHTML = digits(pos);
      dial.querySelector('.rem').innerHTML = digits(dur - pos);
      dial.classList.toggle('alert', playing && dur > 0 && dur - pos < 30);
      // marcador de posición en la tira
      const cv = strips[side];
      cv.style.setProperty('--pos', `${frac * 100}%`);
    }
  }

  // ── Interacción ──
  const hold = new Map();
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    const cue = e.target.closest('.pad.cue');
    const roll = e.target.closest('[data-hold="roll"]');
    const fxp = e.target.closest('[data-a="fxpad"]');
    const vf = e.target.closest('[data-a="spvol"]');
    if (cue && !deleteMode) {
      e.preventDefault();
      const id = ids()[cue.dataset.side];
      const i = Number(cue.dataset.i);
      cue.classList.add('down'); haptic();
      control(id, 'cue_point', 1, i);
      hold.set(e.pointerId, () => { cue.classList.remove('down'); control(id, 'cue_point', 0, i); setTimeout(renderPanel, 400); });
    } else if (roll) {
      e.preventDefault();
      const side = roll.dataset.side, id = ids()[side], idx = loopIdx[side];
      roll.classList.add('on'); haptic();
      control(id, 'auto_loop_roll_specific_length', 1, idx);
      hold.set(e.pointerId, () => { roll.classList.remove('on'); control(id, 'auto_loop_roll_specific_length', 0, idx); });
    } else if (fxp) {
      e.preventDefault();
      fxp.setPointerCapture(e.pointerId);
      const n = Number(fxp.dataset.n), u = fx[n];
      const move = (ev) => {
        const r = fxp.getBoundingClientRect();
        u.depth = Math.max(0, Math.min(1, (r.bottom - ev.clientY) / r.height));
        fxp.querySelector('.fill').style.height = `${u.depth * 100}%`;
        sendValue('fxd' + n, { deck: n, name: 'effect_slot_parameter_1', value: u.depth, prop: 0 });
      };
      const wasOn = u.on;
      if (!u.latch || !wasOn) { u.on = true; control(n, 'effect_slot_enable', 1, 0); fxp.closest('.fx-unit').classList.add('on'); }
      move(e);
      fxp.addEventListener('pointermove', move);
      hold.set(e.pointerId, () => {
        fxp.removeEventListener('pointermove', move);
        if (!u.latch || wasOn) { u.on = false; control(n, 'effect_slot_enable', 0, 0); fxp.closest('.fx-unit').classList.remove('on'); }
      });
    } else if (vf) {
      e.preventDefault();
      vf.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = vf.getBoundingClientRect();
        spVol = Math.max(0, Math.min(1, (r.bottom - ev.clientY) / r.height));
        vf.firstElementChild.style.height = `${spVol * 100}%`;
        sendValue('spvol', { deck: 1, name: 'sample_player_volume', value: spVol, prop: 0 });
      };
      move(e);
      vf.addEventListener('pointermove', move);
      hold.set(e.pointerId, () => vf.removeEventListener('pointermove', move));
    }
  });
  const release = (e) => { const f = hold.get(e.pointerId); if (f) { hold.delete(e.pointerId); f(); } };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  el.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) { tab = t.dataset.tab; prefs.set('rm-tab', tab); haptic(); renderPanel(); return; }
    if (e.target.closest('.rm-collapse')) { collapsed = !collapsed; el.classList.toggle('collapsed', collapsed); requestAnimationFrame(() => { drawStrip('l'); drawStrip('r'); }); return; }
    if (e.target.closest('.rm-gear')) { onSettings(); return; }
    const cue = e.target.closest('.pad.cue');
    if (cue && deleteMode) {
      const id = ids()[cue.dataset.side];
      control(id, 'cue_point_delete', 1, Number(cue.dataset.i));
      deleteMode = false; haptic(); renderPanel(); return;
    }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    const side = b.dataset.side || (b.closest('.rm-side.r, .pb.r') ? 'r' : 'l');
    const id = ids()[side];
    const d = store.decks[id - 1];
    haptic();
    switch (a) {
      case 'play': control(id, 'play', d.rate > 0.001 ? 0 : 1); break;
      case 'sync': sync[id] = true; control(id, 'sync', 1); renderDecks(); break;
      case 'syncoff': sync[id] = false; control(id, 'sync', 0); renderDecks(); break;
      case 'tab': page = page === '12' ? '34' : '12'; prefs.set('page', page); renderDecks(); renderPanel(); break;
      case 'up': control(1, 'library_scroll', -1); break;
      case 'down': control(1, 'library_scroll', 1); break;
      case 'load': chooseLoad(); break;
      case 'loopdn': loopIdx[side] = Math.max(0, loopIdx[side] - 1); renderPanel(); break;
      case 'loopup': loopIdx[side] = Math.min(10, loopIdx[side] + 1); renderPanel(); break;
      case 'autoloop': {
        const on = d.loop.autoLoopOn && d.loop.beatLength === beatsOf(loopIdx[side]);
        if (on) control(id, 'auto_loop_enable', 0);
        else { control(id, 'auto_loop_specific_length', 1, loopIdx[side]); control(id, 'auto_loop_specific_length', 0, loopIdx[side]); }
        break;
      }
      case 'loopsize': {
        const i = Number(b.dataset.i);
        loopIdx[side] = i;
        if (d.loop.autoLoopOn && d.loop.beatLength === beatsOf(i)) control(id, 'auto_loop_enable', 0);
        else { control(id, 'auto_loop_specific_length', 1, i); control(id, 'auto_loop_specific_length', 0, i); }
        renderPanel();
        break;
      }
      case 'lr': rollMode = !rollMode; renderPanel(); break;
      case 'pd': padDeck = side; miniLoops = false; prefs.set('rm-paddeck', side); renderPanel(); break;
      case 'miniloops': miniLoops = !miniLoops; renderPanel(); break;
      case 'del': deleteMode = !deleteMode; renderPanel(); break;
      case 'q': quant = !quant; control(1, 'quantize', quant ? 1 : 0); renderPanel(); break;
      case 'slot': {
        const i = Number(b.dataset.i);
        control(1, 'sample_player_slot_play', 1, i);
        b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 300);
        break;
      }
      case 'spstop': for (let i = 0; i < 6; i++) control(1, 'sample_player_slot_stop', 1, bank * 6 + i); break;
      case 'bank': bank = Number(b.dataset.i); control(1, 'sample_player_bank_select', bank); renderPanel(); break;
      case 'latch': { const u = fx[b.dataset.n]; u.latch = !u.latch; if (!u.latch && u.on) { u.on = false; control(Number(b.dataset.n), 'effect_slot_enable', 0, 0); } renderPanel(); break; }
      case 'beatdn': case 'beatup': {
        const n = Number(b.dataset.n), u = fx[n];
        const steps = [0.125, 0.25, 0.5, 1, 2, 4, 8];
        const i = Math.max(0, Math.min(steps.length - 1, steps.indexOf(u.beats) + (a === 'beatup' ? 1 : -1)));
        u.beats = steps[i];
        control(n, 'effect_bank_beats_multiplier_step', a === 'beatup' ? 1 : -1);
        renderPanel();
        break;
      }
    }
  });

  function chooseLoad() {
    const box = document.createElement('div');
    box.className = 'rm-load';
    const { l, r } = ids();
    box.innerHTML = `<div><p>Cargar la pista seleccionada en…</p><button data-d="${l}">DECK ${l}</button><button data-d="${r}">DECK ${r}</button></div>`;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (b) control(Number(b.dataset.d), 'load_track', 1);
      box.remove();
    });
    el.append(box);
  }

  function setMini(v) {
    mini = v;
    el.classList.toggle('mini', mini);
    if (!mini && tab === 'lib') tab = 'pads';
    renderPanel();
  }

  function setStatus(ok) { q('.conn-dot').className = 'conn-dot ' + ok; }

  function render() { renderDecks(); renderPanel(); }
  function onDeck() { renderDecks(); if (tab === 'pads') renderPads(); }
  function onLoop() { if (tab === 'pads') renderPads(); }

  return { el, render, onDeck, onLoop, frame, setMini, setStatus, redraw: () => { drawStrip('l'); drawStrip('r'); } };
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
