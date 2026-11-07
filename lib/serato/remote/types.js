"use strict";
/**
 * @fileoverview Public types for the Serato Remote OSC-over-TCP client.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SUBSCRIPTION_TOPICS = exports.NUM_REMOTE_DECKS = void 0;
/** Number of decks the protocol supports. */
exports.NUM_REMOTE_DECKS = 4;
/** Default subscription set covering all currently-known status topics. */
exports.DEFAULT_SUBSCRIPTION_TOPICS = [
    '/Register/Status/Deck/Playhead',
    '/Register/Status/Deck/Song/Title',
    '/Register/Status/Deck/Song/Artist',
    '/Register/Status/Deck/Song/Filepath',
    '/Register/Status/Deck/Song/Valid',
    '/Register/Status/Deck/Loop/AutoLoopOn',
    '/Register/Status/Deck/Loop/BeatLength',
    '/Register/Status/Deck/Loop/LoopRollOn',
    '/Register/Status/Video/Deck/Mixer/Upfader',
    '/Register/Status/Video/Mixer/Crossfader',
];
