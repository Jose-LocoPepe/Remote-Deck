# Remote Deck

Ve y controla **Serato DJ Pro** desde el celular, la tablet u otro computador.
Una alternativa propia al discontinuado *Serato Remote*, construida por ingeniería
inversa del protocolo que Serato sigue incluyendo (probado con **Serato DJ Pro 4.0.2** en Windows).

- **En vivo:** pista, artista, key (Camelot), forma de onda con hot cues, tiempo
  transcurrido/restante, BPM, pitch, loops, upfaders y crossfader.
- **Control:** play/pausa, CUE, hot cues, loops (auto loop y roll por tamaño), ½ / ×2,
  keylock, SYNC y nudge de pitch.
- **Modos de pads** como en una controladora: HOT CUE · LOOP · ROLL · SAMPLER · STEMS.
- **Historial del set con buscador:** "¿ya toqué esta?" en un segundo, aviso
  *YA TOCADA* en el deck y descarga del tracklist.
- **5 vistas:** Clásica, Horizontal, Compacta, 4 decks y Un deck.
- **App instalable (PWA):** se agrega a la pantalla de inicio del iPhone o Android.
- **QR en la consola** al arrancar (como Expo) para conectar el celular sin escribir la IP; también desde el botón QR de la app.

> Proyecto no oficial, sin relación con Serato Limited. Serato es marca de sus dueños.

## Requisitos

| | Windows | macOS |
|---|---|---|
| Serato DJ Pro | 3.x / 4.x | 3.x / 4.x |
| Bonjour | **Instalar [Bonjour Print Services](https://support.apple.com/kb/DL999)** (Serato lo usa para descubrir el remote) | Incluido en el sistema |
| Red | El celular y el computador en la misma red Wi-Fi | ídem |

## Uso rápido (ejecutable, sin instalar nada)

1. Descarga el ejecutable de tu sistema desde *Releases* (o compílalo, ver abajo).
2. Ábrelo. La consola muestra un **código QR** (como en Expo) y la dirección `http://192.168.x.x:8080`.
3. Abre Serato DJ Pro: se conecta solo en unos segundos.
4. Escanea el QR con el celular → **Compartir → Agregar a pantalla de inicio**.

En macOS, la primera vez:

```bash
chmod +x RemoteDeck-mac-arm64
xattr -d com.apple.quarantine RemoteDeck-mac-arm64
codesign --sign - RemoteDeck-mac-arm64
./RemoteDeck-mac-arm64
```

y acepta el permiso de **Red local** cuando macOS lo pida.

## Desde el código

Requiere Node.js 22 o superior.

```bash
npm install
npm start
```

Variables opcionales:

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `8080` | Puerto de la página web |
| `REMOTE_PORT` | `52976` | Puerto TCP que se anuncia a Serato (fijo a propósito, ver *Problemas*) |
| `PEER_NAME` | `Remote Deck` | Nombre con el que aparece en Serato |
| `OPEN_BROWSER` | (vacío) | Con `1`, abre además el navegador del PC con el QR en grande |

### Compilar ejecutables

Con [Bun](https://bun.sh) instalado:

```bash
npm run release        # Windows + macOS (arm64 y x64) en release/
npm run release:win    # solo Windows
npm run release:mac    # solo macOS
```

La interfaz queda incrustada dentro del ejecutable; no necesita Node ni npm.

## Problemas comunes

- **Se queda en "Esperando a Serato…"**: en Windows falta Bonjour, o Serato quedó
  enganchado a una instancia anterior → reinicia Serato. Corre una sola instancia de
  Remote Deck a la vez.
- **Los hot cues nuevos no aparecen al tiro en la forma de onda**: Serato los escribe en
  el archivo al expulsar la pista. Remote Deck los muestra igual de inmediato al crearlos
  desde un pad; al recargar la pista quedan los datos reales.
- **Pistas de streaming** (Beatport, Tidal…): no hay archivo local, así que no se ven onda,
  cues ni key; tiempo, BPM y controles sí funcionan.
- **El celular no abre la página**: misma red Wi-Fi, y permite Node/Remote Deck en el
  firewall de Windows (redes privadas).

## Cómo funciona

```
Serato DJ Pro ──(Bonjour + OSC/TCP, protocolo Serato Remote)──▶ Remote Deck (servidor)
                ◀──────────── /Control/ACI/<control> ───────────┘        │
                                                           SSE + HTTP     ▼
                                                     navegador / PWA en el celular
```

- Serato busca servicios `_SeratoIOSRemote._tcp` y **se conecta él al remote**.
  Remote Deck se anuncia, responde el handshake (reto MD5) y recibe el estado.
- Para controlar usa el sistema **ACI** de Serato (el mismo de los mapeos MIDI):
  `/Control/ACI/<nombre>  ,iiif  (deck_set, deck, property, valor)`.
- Detalles: [`docs/serato-remote-protocol.md`](docs/serato-remote-protocol.md) y
  [`research/ACI-FINDINGS.md`](research/ACI-FINDINGS.md).

## Estructura

```
app/
  server.js            servidor: Serato ↔ navegadores, control, historial, QR
  lib/history.js       historial del set (~/.remote-deck/history-AAAA-MM-DD.json)
  lib/network.js       IP de la red local y código QR
  build.js             compilación a ejecutables (Bun)
  public/              la app web (PWA)
    js/main.js         arranque: arma componentes y aplica la vista
    js/state.js        estado compartido + conexión en vivo (SSE)
    js/components/     deck, mixer, topbar, history, qr
    js/pads.js         modos de pads
    js/layouts.js      vistas
    css/               estilos por componente
lib/serato/            protocolo Serato Remote y lectura de tags (de serato-connect, MIT)
research/              hallazgos y scripts de ingeniería inversa del ACI
docs/                  especificación del protocolo
```

## Hoja de ruta

- [x] SAMPLER: deck_set 1, slot en el campo deck.
- [x] STEMS: silenciar y solo por stem (`codfather_st`, `codfather_st_solo`).
- [ ] Estado ACI por deck (hoy solo llega el del deck 1).
- [ ] Explorar la biblioteca y cargar pistas desde el celular.
- [ ] Indicadores de fraseo (compases, beats hasta el siguiente cue).

## Créditos y licencia

MIT — ver [LICENSE](LICENSE).

El código de `lib/serato/` proviene de [serato-connect](https://github.com/chrisle/serato-connect)
de Chris Le (MIT), cuya licencia se conserva en [`lib/serato/LICENSE`](lib/serato/LICENSE).
