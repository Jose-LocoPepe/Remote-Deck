"use strict";
/**
 * @fileoverview Bonjour publisher for the `_SeratoIOSRemote._tcp` service.
 *
 * Serato DJ Pro browses for this service and connects to whatever is
 * advertising it. We publish a bare advert (empty TXT) and let Serato drive
 * the TCP handshake on top.
 *
 * Uses bonjour-service to avoid pulling in native dependencies.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERATO_REMOTE_SERVICE_TYPE = void 0;
exports.buildInstanceName = buildInstanceName;
exports.publishSeratoRemote = publishSeratoRemote;
const node_os_1 = require("node:os");
const logger_js_1 = require("../types/logger.js");
/**
 * Service-type fragment of the Bonjour record. Combined by bonjour-service
 * into the full `_SeratoIOSRemote._tcp.local.` address.
 */
exports.SERATO_REMOTE_SERVICE_TYPE = 'SeratoIOSRemote';
/**
 * Build the canonical instance name used by Serato Remote: `<peerName> @ <hostname>`
 * with the literal `@` separator and surrounding spaces. Passing a
 * `.local`-suffixed hostname is fine — bonjour-service won't double-suffix.
 */
function buildInstanceName(peerName, host = (0, node_os_1.hostname)()) {
    return `${peerName} @ ${host}`;
}
/**
 * Publish the Bonjour service. Returns a handle whose `stop()` tears down
 * both the advert and the responder. Designed to be lightweight enough that
 * a caller can publish, run a session, and then tear down without leaking
 * sockets.
 */
async function publishSeratoRemote(options) {
    const logger = options.logger ?? logger_js_1.noopLogger;
    const instanceName = buildInstanceName(options.peerName, options.host);
    // Lazy-load bonjour-service so the rest of the package doesn't pull it in
    // when the consumer only uses the file-based readers.
    const mod = await Promise.resolve().then(() => __importStar(require('bonjour-service')));
    const Bonjour = mod.Bonjour
        ?? mod.default;
    if (typeof Bonjour !== 'function') {
        throw new Error('bonjour-service is not installed; install it to use the Serato Remote protocol');
    }
    const bonjour = new Bonjour();
    const service = bonjour.publish({
        name: instanceName,
        type: exports.SERATO_REMOTE_SERVICE_TYPE,
        protocol: 'tcp',
        port: options.port,
        // Empty TXT record — Serato accepts a bare advert.
        txt: {},
    });
    logger.info('mdns: publishing %s on port %d', instanceName, options.port);
    return {
        instanceName,
        port: options.port,
        stop: () => new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done)
                    return;
                done = true;
                try {
                    bonjour.destroy();
                }
                catch (err) {
                    logger.warn('mdns: error destroying responder', err);
                }
                resolve();
            };
            try {
                service.stop(finish);
                // Bail out if stop() never fires the callback (some bonjour
                // implementations don't on certain platforms).
                setTimeout(finish, 1000).unref?.();
            }
            catch (err) {
                logger.warn('mdns: error stopping advert', err);
                finish();
            }
        }),
    };
}
