# ACI over Serato Remote: findings (Serato DJ Pro 4.0.2.338, Windows, 2026-11-07)

## Confirmed live
- `/Register/Status/ACI/<name>` works. **`<name>` is the control's name** (e.g. `play`,
  `cue`, `keylock`, `sync_mode`), not a number. Numeric ids are rejected.
- Serato replies with `/Status/ACI/<name>` carrying **one argument**: `f` (value) or `s` (text).
  About 140 controls answer on subscribe (see aci-probe.log).
- Updates arrive in real time (`play f:1/0`, `cue f:1`, `loop_in/loop_out/auto_loop_enable f:1/0`).
- **ACI updates only arrive for deck 1.** Deck 2 actions produced no ACI messages.
- The Serato log (`~/Music/_Serato_/Logs/*.log`) prints
  `[UserIo] Invalid ACI message ID in identifier: <x>` for every bad identifier. It works as an oracle.
- Internally a message key is `(id, deck_id, deck_set, property)`
  (log: `invalid key, id: ... deck_id: 0 deck_set: 0 property: 0`).
  Deck sets: `Sample Player`, `Aux`, `DJ Effects`, `External Deck`, `No Deck Set`.

## Tried, no effect
- `/Control/ACI/play f:1` / `f:0`, and `/Control/ACI/play i:1 f:1`: nothing happened and nothing was logged.
- Identifier suffixes for deck (`play/1`, `play:1`, `1/play`, `deck/1/play`, `play.1`, `play[1]`,
  `play_1`, `play?deck=1`, `play@1`, `play#1`): all rejected as invalid.
- `/Register/Status/ACI/play` with an `i:1` or `s:1` argument: no visible effect.

## Open questions
- How deck_id/deck_set are chosen for the remote (perhaps pairing args, or a separate "select deck" message).
- The argument format `/Control/ACI` expects, and whether it needs a prior registration.
- Next step: static analysis (Ghidra) of the code around the strings
  `/Control/ACI/` and `Tried to inject unmapped ACI message with id:`, or Frida hooks on that handler.

Scripts: aci-probe.js (subscribe + log), aci-control-test.js, aci-ident-test.js.

## RESUELTO: control (verificado en vivo 2026-11-07)
Ghidra: el handler `0x1415a3f10` toma `/Control/ACI/<nombre>`, convierte el nombre en ID, lee
**tres int32** y después un valor cuyo tipo decide la rama (`i` / `f` / `s`).

```
/Control/ACI/<nombre>  ,iiif  (deck_set, deck, property, value)
```
- `deck_set`: 0 = decks principales (con 1 no pasó nada).
- `deck`: índice desde 0 (0 = deck 1, 1 = deck 2).
- `property`: 0 (en `play` no tuvo efecto).
- `value`: `play` es absoluto (1 = play, 0 = pausa).

Probado: `/Control/ACI/play i:0 i:0 i:0 f:1` arranca el deck 1 y `i:0 i:1 i:0 f:1` arranca el deck 2.

## Problema de conexión: usar un puerto TCP fijo
Después de muchos reinicios del remote, Serato deja de conectarse o se conecta a puertos
muertos (ECONNRESET): Bonjour cachea los anuncios viejos. Publicar siempre en el mismo puerto
(por ejemplo 52976) lo soluciona. Remote Deck ahora usa `REMOTE_PORT` (52976 por defecto).

## Más controles verificados en vivo (2026-11-07)
| Control | Argumentos | Comportamiento |
|---|---|---|
| `sync` | value 1/0 | Activa o desactiva SYNC; Serato confirma con `/Status/ACI/sync`. |
| `pitch_bend_up` / `pitch_bend_down` | value 1 al presionar, 0 al soltar | Nudge temporal (rate 1.039 mientras se mantiene, vuelve a 1.0). |
| `pitch_nudge_up` / `_down` | value 1/0 | Cambio **permanente** de pitch fino (no sirve para nudge). |
| `auto_loop_specific_length` | property = índice de tamaño, value 1 | Activa un auto loop; queda activo al soltar. |
| `auto_loop_roll_specific_length` | property = índice, value 1/0 | Loop roll mientras se mantiene. |
| `loop_length_half` / `_double` | value 1 (un pulso) | Actúa con cualquier valor: enviar 1 y 0 avanza dos pasos. |
| `cue_point` | property = pad (0-7), value 1/0 | Dispara o crea el hot cue. |

Índice de tamaño de loop: `0` = 1/32 beat, y cada paso duplica (`3` = 1/4, `5` = 1, `7` = 4, `10` = 32).

No expuestos por ACI (log: `Tried to inject unmapped ACI message`): `stems`, `vocals`.
Rechazados como identificadores: `drums`, `melody`, `all_stems`, `stem_fx`.
`sample_player_slot_play` no dio una respuesta visible con los slots vacíos; falta probarlo con samples cargados.

## Mapa de controles inyectables (Ghidra, Serato DJ Pro 4.0.2)

`/Control/ACI/<nombre>` solo acepta nombres de un mapa nombre→id que arma el
inicializador estático `FUN_1403b0320` (1418 entradas de 0x28 bytes, copiadas a la
lista global `0x144015090`). La consulta es `FUN_141570630`: si el nombre no está,
el manejador `FUN_1415a3f10` registra *"Tried to inject unmapped ACI message"*.

Los nombres están cifrados en `.rdata`: `c = rotr8(b ^ 0xE7, i & 7)`, con i como posición del byte.
La lista completa está en [`aci-inject-map-4.0.2.tsv`](aci-inject-map-4.0.2.tsv) (id, nombre).

Consecuencias:
- `stems` y `vocals` **no** están en el mapa (por eso el error "unmapped"). La tabla
  `vocals/bass/drums/melody` (`FUN_140404f30`) es interna, con índices 0-3.
- Sí existen, y quedan **por probar**: `stems_acapella_set_state`, `stems_instrumental_set_state`,
  `stems_all_set_state`, `stem_split_control`, `stem_slip`, `stems_levels_enable`,
  `extract_stem_to_target_deck` y `stem_fx_plus_*`.
- Biblioteca: `library_scroll`, `fast_library_scroll`, `library_search_text_set`
  (probablemente `,s`), `tab_library`, `load_track`, `load_uri`, `load_uri_string`
  y `undo_load_track`.
- Otros: `beat_jump`, `beat_jump_length_specific`, `beat_num`, `next_beat_after`,
  `display_beat_position_indicator` (fraseo) y todo `sample_player_*`.

### Stems: verificado en vivo (4.0.2, deck 1)
| Control | Args `(set, deck, prop, v)` | Efecto observado |
|---|---|---|
| `stems_acapella_set_state` | `0, d, 0, 1/0` | activa o quita el modo acapella (`stems_all_set_state` pasa a 0 y vuelve a 1) |
| `stems_instrumental_set_state` | `0, d, 0, 1/0` | activa o quita el modo instrumental |
| `stem_split_control` | `0, d, stem, 1/0` | con 1 cambia el stem (0 vocals, 1 bass, 2 drums, 3 melody), con 0 lo restaura |

Estado: suscribirse a `stems_all_set_state`, `stems_playing` y `stems_audio_loaded` (este último indica que la pista tiene stems).

**Corrección:** `stem_split_control` es *Stem Split*: deja las voces en el deck y manda la instrumental al deck pareado. `prop` se ignora. Los stems individuales se controlan así (verificado en vivo):

| Control | Args | Efecto |
|---|---|---|
| `codfather_st` | `0, d, stem, 1` | cada pulso silencia o devuelve el stem (0 vocals, 1 bass, 2 drums, 3 melody) |
| `codfather_st_solo` | `0, d, stem, 1/0` | con 1 suena solo ese stem; con 0 vuelve todo |

Los ids internos por stem (1707, 1709) no están en el mapa inyectable.

### Sampler: verificado en vivo
`sample_player_slot_play` / `sample_player_slot_stop`: **`(1, slot, 0, 1)`**, con deck_set = 1 y el slot 0-7 en el campo *deck*.
Con deck_set 0 Serato acepta el mensaje, pero no hace nada; con deck_set 2 o 3 responde "Cant broadcast - invalid key".
El manejador de estado está en `FUN_14061bad0` (casos 0x3bf-0x3d8).
