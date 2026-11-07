/**
 * Historial del set: registra cada pista que realmente sonó.
 *
 * Una pista cuenta como "tocada" cuando suena al menos PLAYED_AFTER_S segundos
 * desde que se cargó (así no se cuentan las que solo se previsualizan).
 * Se guarda en un archivo por noche en ~/.remote-deck/, de modo que reiniciar
 * el servidor no borra el set. La "noche" empieza a las 06:00: un set que pasa
 * de medianoche sigue en el mismo archivo.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLAYED_AFTER_S = 15;
const NIGHT_STARTS_AT_HOUR = 6;

function nightKey(date = new Date()) {
  const d = new Date(date.getTime() - NIGHT_STARTS_AT_HOUR * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

class SetHistory {
  constructor(dir = path.join(os.homedir(), '.remote-deck')) {
    this.dir = dir;
    this.key = nightKey();
    this.entries = this.load();
    /** Por deck: { loadedAt, startPos, logged } */
    this.tracking = new Map();
  }

  get file() {
    return path.join(this.dir, `history-${this.key}.json`);
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return [];
    }
  }

  save() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.entries, null, 1));
    } catch (e) {
      console.warn('historial: no se pudo guardar', e.message);
    }
  }

  /** Llamar cuando un deck carga (o expulsa) una pista. */
  onLoad(deckId) {
    this.tracking.set(deckId, { loadedAt: Date.now(), startPos: null, logged: false });
  }

  /**
   * Llamar en cada actualización de posición. Devuelve la entrada nueva si la
   * pista acaba de contar como tocada; si no, null.
   */
  onPlayhead(deck) {
    const t = this.tracking.get(deck.id);
    if (!t || t.logged || !deck.track || !(deck.rate > 0.001)) return null;
    if (t.startPos == null || deck.pos < t.startPos) t.startPos = deck.pos;
    if (deck.pos - t.startPos < PLAYED_AFTER_S) return null;
    t.logged = true;
    if (nightKey() !== this.key) {
      this.key = nightKey();
      this.entries = this.load();
    }
    const entry = {
      at: Date.now(),
      deck: deck.id,
      title: deck.track.title || path.basename(deck.track.filePath || ''),
      artist: deck.track.artist || '',
      filePath: deck.track.filePath || '',
    };
    this.entries.push(entry);
    this.save();
    return entry;
  }

  loadedAt(deckId) {
    return this.tracking.get(deckId)?.loadedAt ?? 0;
  }

  /** Tracklist en texto plano: "HH:MM  Artista - Título". */
  toText() {
    const lines = this.entries.map((e) => {
      const hhmm = new Date(e.at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      return `${hhmm}  ${e.artist ? `${e.artist} - ` : ''}${e.title}`;
    });
    return `Remote Deck — set del ${this.key}\n\n${lines.join('\n')}\n`;
  }
}

module.exports = { SetHistory, PLAYED_AFTER_S };
