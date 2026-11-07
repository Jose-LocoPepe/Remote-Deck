"use strict";
/**
 * @fileoverview Public API for the Serato Remote OSC-over-TCP client.
 *
 * See ../docs/protocol.md for protocol details and ../docs/open-questions.md
 * for behaviors still pending live-session confirmation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SUBSCRIPTION_TOPICS = exports.NUM_REMOTE_DECKS = exports.FRAME_SENTINEL = exports.FrameReader = exports.frameOsc = exports.arg = exports.osc = exports.decodeOsc = exports.encodeOsc = exports.SERATO_REMOTE_SERVICE_TYPE = exports.buildInstanceName = exports.publishSeratoRemote = exports.RemoteSession = exports.RemoteServer = exports.SeratoRemoteClient = void 0;
var client_js_1 = require("./client.js");
Object.defineProperty(exports, "SeratoRemoteClient", { enumerable: true, get: function () { return client_js_1.SeratoRemoteClient; } });
var server_js_1 = require("./server.js");
Object.defineProperty(exports, "RemoteServer", { enumerable: true, get: function () { return server_js_1.RemoteServer; } });
Object.defineProperty(exports, "RemoteSession", { enumerable: true, get: function () { return server_js_1.RemoteSession; } });
var mdns_js_1 = require("./mdns.js");
Object.defineProperty(exports, "publishSeratoRemote", { enumerable: true, get: function () { return mdns_js_1.publishSeratoRemote; } });
Object.defineProperty(exports, "buildInstanceName", { enumerable: true, get: function () { return mdns_js_1.buildInstanceName; } });
Object.defineProperty(exports, "SERATO_REMOTE_SERVICE_TYPE", { enumerable: true, get: function () { return mdns_js_1.SERATO_REMOTE_SERVICE_TYPE; } });
var osc_js_1 = require("./osc.js");
Object.defineProperty(exports, "encodeOsc", { enumerable: true, get: function () { return osc_js_1.encodeOsc; } });
Object.defineProperty(exports, "decodeOsc", { enumerable: true, get: function () { return osc_js_1.decodeOsc; } });
Object.defineProperty(exports, "osc", { enumerable: true, get: function () { return osc_js_1.osc; } });
Object.defineProperty(exports, "arg", { enumerable: true, get: function () { return osc_js_1.arg; } });
var framing_js_1 = require("./framing.js");
Object.defineProperty(exports, "frameOsc", { enumerable: true, get: function () { return framing_js_1.frameOsc; } });
Object.defineProperty(exports, "FrameReader", { enumerable: true, get: function () { return framing_js_1.FrameReader; } });
Object.defineProperty(exports, "FRAME_SENTINEL", { enumerable: true, get: function () { return framing_js_1.FRAME_SENTINEL; } });
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "NUM_REMOTE_DECKS", { enumerable: true, get: function () { return types_js_1.NUM_REMOTE_DECKS; } });
Object.defineProperty(exports, "DEFAULT_SUBSCRIPTION_TOPICS", { enumerable: true, get: function () { return types_js_1.DEFAULT_SUBSCRIPTION_TOPICS; } });
