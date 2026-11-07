// Componente Deck: un deck completo (cabecera, onda, tiempos, plato,
// transporte, hot cues, estado de loop). Se dibuja solo cuando cambia su deck.
import { fmtTime, camelot, fileName, pitchText } from '../format.js';
import { control, haptic } from '../control.js';

export const DECK_COLORS = ['#2f9bff', '#ff8a2a', '#36d17a', '#e5484d'];
const RING = 276.46; // 2πr con r=44

const TEMPLATE = `
  <header class="d-head">
    <div class="num"></div>
    <div class="info"><div class="title">—</div><div class="artist">Sin pista</div></div>
    <div class="key"></div>
  </header>
  <div class="d-ov"><canvas></canvas><div class="loopband"></div><div class="playhead"></div></div>
  <div class="d-readout">
    <div class="times"><div class="elapsed">0:00.0</div><div class="remain"></div></div>
    <div class="platter">
      <svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="44"/><circle class="ring" cx="50" cy="50" r="44"/></svg>
      <div class="spin"><i></i></div>
      <div class="bpm"><b>—</b><small>BPM</small><em></em></div>
    </div>
  </div>
  <div class="d-transport">
    <button class="btn cuebtn" data-hold="cue">CUE</button>
    <button class="btn playbtn" data-act="play"><span class="ico">▶</span></button>
    <button class="btn" data-act="loop_length_half">½</button>
    <button class="btn loopbtn" data-act="loop">LOOP</button>
    <button class="btn" data-act="loop_length_double">×2</button>
    <button class="btn keybtn" data-act="keylock">KEY</button>
  </div>
  <div class="d-cues"></div>
  <footer class="d-loops">
    <span class="tag auto">LOOP</span><span class="tag roll">ROLL</span><span class="beats"></span>
    <span class="state"></span>
  </footer>`;

export function createDeck(store, id) {
  const el = document.createElement('section');
  el.className = 'deck empty';
  el.dataset.deck = id;
  el.style.setProperty('--deck', DECK_COLORS[id - 1]);
  el.innerHTML = TEMPLATE;
  const q = (s) => el.querySelector(s);
  const r = {
    num: q('.num'), title: q('.title'), artist: q('.artist'), key: q('.key'),
    canvas: q('canvas'), playhead: q('.playhead'), loopband: q('.loopband'),
    elapsed: q('.elapsed'), remain: q('.remain'), ring: q('.ring'), spin: q('.spin'),
    bpm: q('.bpm b'), pitch: q('.bpm em'), state: q('.state'),
    auto: q('.tag.auto'), roll: q('.tag.roll'), beats: q('.beats'),
    playbtn: q('.playbtn'), playico: q('.playbtn .ico'), loopbtn: q('.loopbtn'), keybtn: q('.keybtn'),
  };
  r.num.textContent = id;
  const cuesEl = q('.d-cues');
  const pads = Array.from({ length: 8 }, (_, i) => {
    const b = document.createElement('button');
    b.className = 'cue';
    b.textContent = i + 1;
    cuesEl.appendChild(b);
    return b;
  });
  let keylock = false;
  let lastPlaying = null;
  const deck = () => store.decks[id - 1];

  // ── Interacción ──
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  const holdTarget = (t) => t.closest('[data-hold], .cue');
  el.addEventListener('pointerdown', (e) => {
    const b = holdTarget(e.target);
    if (!b) return;
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    b.classList.add('down');
    haptic();
    const idx = pads.indexOf(b);
    b._ctl = idx >= 0 ? ['cue_point', idx] : [b.dataset.hold, 0];
    control(id, b._ctl[0], 1, b._ctl[1]);
  });
  const release = (e) => {
    const b = holdTarget(e.target);
    if (!b?._ctl) return;
    b.classList.remove('down');
    control(id, b._ctl[0], 0, b._ctl[1]);
    b._ctl = null;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    haptic();
    const d = deck();
    const act = b.dataset.act;
    // ½ / ×2: Serato actúa con cualquier valor → un solo pulso
    if (act.startsWith('loop_length_')) control(id, act, 1);
    else if (act === 'play') control(id, 'play', d.rate > 0.001 ? 0 : 1);
    else if (act === 'loop') control(id, 'auto_loop_enable', d.loop.autoLoopOn ? 0 : 1);
    else if (act === 'keylock') {
      keylock = !keylock;
      control(id, 'keylock', keylock ? 1 : 0);
      r.keybtn.classList.toggle('on', keylock);
    }
  });

  // ── Render: solo cuando cambian pista / metadatos ──
  function render() {
    const d = deck();
    el.classList.toggle('empty', !d.track);
    r.title.textContent = d.track ? d.track.title || fileName(d.track.filePath) : '—';
    r.artist.textContent = d.track ? d.track.artist || '' : 'Sin pista';
    r.key.textContent = camelot(d.meta?.key);
    r.num.style.boxShadow = d.meta?.color ? `inset 0 -4px 0 ${d.meta.color}` : '';
    const cues = d.meta?.cues || [];
    pads.forEach((p, i) => {
      const c = cues.find((x) => x.index === i);
      p.classList.toggle('set', !!c);
      p.style.background = c?.color || '';
      p.title = c?.name || '';
    });
    renderLoop();
    drawOverview();
  }

  function renderLoop() {
    const d = deck();
    r.auto.classList.toggle('on', !!d.loop.autoLoopOn);
    r.roll.classList.toggle('on', !!d.loop.loopRollOn);
    r.loopbtn.classList.toggle('on', !!d.loop.autoLoopOn);
    const b = d.loop.beatLength;
    r.beats.textContent = b ? (b < 1 ? `1/${Math.round(1 / b)}` : `${b}`) : '';
  }

  function drawOverview() {
    const d = deck();
    const cv = r.canvas;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    const peaks = d.meta?.overview;
    if (peaks?.length) {
      const bw = w / peaks.length;
      g.fillStyle = d.meta?.color || DECK_COLORS[id - 1];
      for (let i = 0; i < peaks.length; i++) {
        const ph = Math.max(1, peaks[i] * (h - 6));
        g.fillRect(i * bw, (h - ph) / 2, Math.max(1, bw - 0.4), ph);
      }
    } else if (d.track) {
      g.fillStyle = '#2a2e37';
      g.fillRect(0, h / 2 - 1, w, 2);
    }
    const dur = d.meta?.duration;
    if (dur) {
      for (const c of d.meta.cues || []) {
        const x = (c.pos / dur) * w;
        g.fillStyle = c.color || '#fff';
        g.fillRect(x - 1, 0, 2, h);
        g.beginPath();
        g.moveTo(x - 4, 0);
        g.lineTo(x + 4, 0);
        g.lineTo(x, 6);
        g.fill();
      }
    }
  }

  // ── Frame: cada cuadro de animación, solo lo que se mueve ──
  function frame(now) {
    const d = deck();
    const playing = d.rate > 0.001;
    const pos = store.positionOf(d, now);
    const dur = d.meta?.duration || 0;
    if (playing !== lastPlaying) {
      lastPlaying = playing;
      el.classList.toggle('playing', playing);
      r.playico.textContent = playing ? '❚❚' : '▶';
      r.playbtn.classList.toggle('on', playing);
    }
    r.state.textContent = !d.track ? '' : playing ? '▶ PLAY' : '❚❚ PAUSA';
    r.elapsed.textContent = fmtTime(pos);
    const rem = dur - pos;
    r.remain.textContent = dur ? `-${fmtTime(rem)}` : '';
    r.remain.classList.toggle('alert', playing && dur > 0 && rem < 30);
    const frac = dur ? Math.max(0, Math.min(1, pos / dur)) : 0;
    r.ring.style.strokeDashoffset = RING * (1 - frac);
    r.playhead.style.left = `${frac * 100}%`;
    r.playhead.style.display = dur ? '' : 'none';
    r.spin.style.transform = `rotate(${((pos / 1.8) * 360) % 360}deg)`; // 33⅓ rpm
    r.bpm.textContent = d.track && d.bpm ? d.bpm.toFixed(1) : '—';
    r.pitch.textContent = d.track ? pitchText(d.rate) : '';
    const lp = d.loop.autoLoopOn && dur ? (d.meta?.loops || []).find((l) => pos >= l.start && pos <= l.end) : null;
    r.loopband.style.display = lp ? 'block' : 'none';
    if (lp) {
      r.loopband.style.left = `${(lp.start / dur) * 100}%`;
      r.loopband.style.width = `${((lp.end - lp.start) / dur) * 100}%`;
    }
  }

  return { id, el, render, renderLoop, drawOverview, frame };
}
