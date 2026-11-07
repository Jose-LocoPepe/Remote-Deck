"use strict";
/**
 * GEOB frame parsers for Serato metadata.
 *
 * Serato stores track metadata in GEOB (General Encapsulated Object) frames
 * within ID3v2 tags (for MP3/AIFF) or Vorbis comments (for FLAC/Ogg).
 *
 * @module parsers/geob
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAutotagsFromBase64 = exports.parseAutotags = exports.isDynamicBeatgrid = exports.getBpmFromBeatgrid = exports.parseBeatgridFromBase64 = exports.parseBeatgrid = exports.parseMarkers2FromGeob = exports.parseMarkers2FromBase64 = exports.parseMarkers2 = void 0;
var markers2_js_1 = require("./markers2.js");
Object.defineProperty(exports, "parseMarkers2", { enumerable: true, get: function () { return markers2_js_1.parseMarkers2; } });
Object.defineProperty(exports, "parseMarkers2FromBase64", { enumerable: true, get: function () { return markers2_js_1.parseMarkers2FromBase64; } });
Object.defineProperty(exports, "parseMarkers2FromGeob", { enumerable: true, get: function () { return markers2_js_1.parseMarkers2FromGeob; } });
var beatgrid_js_1 = require("./beatgrid.js");
Object.defineProperty(exports, "parseBeatgrid", { enumerable: true, get: function () { return beatgrid_js_1.parseBeatgrid; } });
Object.defineProperty(exports, "parseBeatgridFromBase64", { enumerable: true, get: function () { return beatgrid_js_1.parseBeatgridFromBase64; } });
Object.defineProperty(exports, "getBpmFromBeatgrid", { enumerable: true, get: function () { return beatgrid_js_1.getBpmFromBeatgrid; } });
Object.defineProperty(exports, "isDynamicBeatgrid", { enumerable: true, get: function () { return beatgrid_js_1.isDynamicBeatgrid; } });
var autotags_js_1 = require("./autotags.js");
Object.defineProperty(exports, "parseAutotags", { enumerable: true, get: function () { return autotags_js_1.parseAutotags; } });
Object.defineProperty(exports, "parseAutotagsFromBase64", { enumerable: true, get: function () { return autotags_js_1.parseAutotagsFromBase64; } });
