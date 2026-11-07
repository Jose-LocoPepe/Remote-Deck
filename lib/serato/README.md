# lib/serato

JavaScript compilado de [serato-connect](https://github.com/chrisle/serato-connect)
v1.4.6 (MIT, © Chris Le; licencia original en `LICENSE`). Solo las partes que usa Remote Deck:

- `remote/`: cliente del protocolo Serato Remote (Bonjour, framing OSC, handshake MD5, pairing).
- `readers/`, `parsers/geob/`: lectura de los tags de Serato en el archivo (cues, loops,
  color, beatgrid, overview).

Se incluyen copiados (no como dependencia npm) para evitar el driver SQLite nativo del
paquete completo, que impide compilar a un ejecutable con Bun.
