"use strict";
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
exports.MAX_RETRIES = exports.REQUEST_TIMEOUT_MS = void 0;
exports.parseJsonSafely = parseJsonSafely;
exports.httpGetJson = httpGetJson;
exports.downloadToFile = downloadToFile;
exports.httpPost = httpPost;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const errors_1 = require("./errors");
exports.REQUEST_TIMEOUT_MS = 60000;
exports.MAX_RETRIES = 2;
function parseJsonSafely(body) {
    try {
        return JSON.parse(body);
    }
    catch {
        return body;
    }
}
async function httpGetJson(urlString, userAgent) {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        const req = transport.request({
            hostname: url.hostname,
            port: url.port,
            path: `${url.pathname}${url.search}`,
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': userAgent,
            },
        }, (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            res.on('end', () => {
                const parsed = parseJsonSafely(responseBody);
                const status = res.statusCode ?? 500;
                if (status < 200 || status >= 300) {
                    reject(new errors_1.HttpError(`Request failed with status ${status}`, status, parsed));
                    return;
                }
                resolve(parsed);
            });
        });
        req.setTimeout(exports.REQUEST_TIMEOUT_MS, () => {
            req.destroy(new errors_1.CliError(`Request timed out after ${exports.REQUEST_TIMEOUT_MS / 1000}s`, errors_1.EXIT_CODES.NETWORK_ERROR));
        });
        req.on('error', (error) => {
            reject(error instanceof errors_1.CliError
                ? error
                : new errors_1.CliError(`Network request failed: ${(0, errors_1.getErrorMessage)(error)}`, errors_1.EXIT_CODES.NETWORK_ERROR));
        });
        req.end();
    });
}
async function downloadToFile(urlString, destination, userAgent) {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    await fs.ensureDir(path.dirname(destination));
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(destination, { mode: 0o755 });
        const req = transport.get({
            hostname: url.hostname,
            port: url.port,
            path: `${url.pathname}${url.search}`,
            headers: {
                'User-Agent': userAgent,
            },
        }, (res) => {
            if ((res.statusCode ?? 500) >= 300 && (res.statusCode ?? 500) < 400 && res.headers.location) {
                fileStream.close();
                fs.remove(destination).catch(() => undefined).finally(() => {
                    downloadToFile(res.headers.location, destination, userAgent).then(resolve).catch(reject);
                });
                return;
            }
            if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
                fileStream.close();
                fs.remove(destination).catch(() => undefined).finally(() => {
                    reject(new errors_1.CliError(`Download failed with status ${res.statusCode ?? 500}`, errors_1.EXIT_CODES.NETWORK_ERROR));
                });
                return;
            }
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        });
        req.setTimeout(exports.REQUEST_TIMEOUT_MS, () => {
            req.destroy(new errors_1.CliError(`Download timed out after ${exports.REQUEST_TIMEOUT_MS / 1000}s`, errors_1.EXIT_CODES.NETWORK_ERROR));
        });
        req.on('error', (error) => {
            fileStream.close();
            fs.remove(destination).catch(() => undefined).finally(() => {
                reject(error instanceof errors_1.CliError
                    ? error
                    : new errors_1.CliError(`Download failed: ${(0, errors_1.getErrorMessage)(error)}`, errors_1.EXIT_CODES.NETWORK_ERROR));
            });
        });
    });
}
async function httpPost(baseUrl, token, endpoint, body) {
    const url = new URL(endpoint, baseUrl);
    const transport = url.protocol === 'https:' ? https : http;
    for (let attempt = 0; attempt <= exports.MAX_RETRIES; attempt += 1) {
        try {
            return await new Promise((resolve, reject) => {
                const data = JSON.stringify(body);
                const req = transport.request({
                    hostname: url.hostname,
                    port: url.port,
                    path: `${url.pathname}${url.search}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data),
                        Authorization: `Bearer ${token}`,
                    },
                }, (res) => {
                    let responseBody = '';
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        responseBody += chunk;
                    });
                    res.on('end', () => {
                        const parsed = parseJsonSafely(responseBody);
                        const status = res.statusCode ?? 500;
                        if (status < 200 || status >= 300) {
                            reject(new errors_1.HttpError(`Request failed with status ${status}`, status, parsed, status === 401 || status === 403 ? errors_1.EXIT_CODES.AUTH_ERROR : errors_1.EXIT_CODES.API_ERROR));
                            return;
                        }
                        resolve({ status, data: parsed });
                    });
                });
                req.setTimeout(exports.REQUEST_TIMEOUT_MS, () => {
                    req.destroy(new errors_1.CliError(`Request timed out after ${exports.REQUEST_TIMEOUT_MS / 1000}s`, errors_1.EXIT_CODES.NETWORK_ERROR));
                });
                req.on('error', (error) => {
                    reject(error instanceof errors_1.CliError
                        ? error
                        : new errors_1.CliError(`Network request failed: ${(0, errors_1.getErrorMessage)(error)}`, errors_1.EXIT_CODES.NETWORK_ERROR));
                });
                req.write(data);
                req.end();
            });
        }
        catch (error) {
            const shouldRetry = attempt < exports.MAX_RETRIES && error instanceof errors_1.CliError && error.exitCode === errors_1.EXIT_CODES.NETWORK_ERROR;
            if (!shouldRetry)
                throw error;
        }
    }
    throw new errors_1.CliError('Request failed after retries.', errors_1.EXIT_CODES.NETWORK_ERROR);
}
