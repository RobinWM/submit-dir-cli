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
exports.RELEASE_REPO = void 0;
exports.compareVersions = compareVersions;
exports.getExecutablePath = getExecutablePath;
exports.writeUpdateCheckCache = writeUpdateCheckCache;
exports.getLatestReleaseInfo = getLatestReleaseInfo;
exports.maybeNotifyUpdate = maybeNotifyUpdate;
exports.runSelfUpdate = runSelfUpdate;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const errors_1 = require("./errors");
const http_1 = require("./http");
exports.RELEASE_REPO = 'RobinWM/ship-cli';
const RELEASE_API_URL = `https://api.github.com/repos/${exports.RELEASE_REPO}/releases/latest`;
const UPDATE_CHECK_PATH = path.join(process.env.HOME || '', '.config', 'ship', 'update-check.json');
const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
function compareVersions(left, right) {
    const parse = (value) => value.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
    const leftParts = parse(left);
    const rightParts = parse(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLength; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;
        if (leftValue > rightValue)
            return 1;
        if (leftValue < rightValue)
            return -1;
    }
    return 0;
}
function detectPlatformAssetName() {
    const platform = process.env.TEST_SUBMIT_DIR_PLATFORM || process.platform;
    const arch = process.env.TEST_SUBMIT_DIR_ARCH || process.arch;
    if (platform === 'linux') {
        if (arch === 'x64')
            return 'ship-linux-x64';
        if (arch === 'arm64')
            return 'ship-linux-arm64';
    }
    if (platform === 'darwin') {
        if (arch === 'x64')
            return 'ship-darwin-x64';
        if (arch === 'arm64')
            return 'ship-darwin-arm64';
    }
    return null;
}
function getExecutablePath() {
    return fs.realpathSync(process.argv[1]);
}
function getReleaseAssetUrl(assets) {
    const assetName = detectPlatformAssetName();
    if (!assetName)
        return undefined;
    return assets.find((asset) => asset.name === assetName)?.browser_download_url;
}
async function fetchLatestReleaseInfo(cliVersion) {
    if (process.env.TEST_SUBMIT_DIR_LATEST_VERSION) {
        return {
            version: process.env.TEST_SUBMIT_DIR_LATEST_VERSION,
            downloadUrl: process.env.TEST_SUBMIT_DIR_DOWNLOAD_URL,
            assets: [],
        };
    }
    const response = await (0, http_1.httpGetJson)(RELEASE_API_URL, `ship/${cliVersion}`);
    const version = response.tag_name.replace(/^v/, '');
    const assets = response.assets ?? [];
    return {
        version,
        assets,
        downloadUrl: getReleaseAssetUrl(assets),
    };
}
async function readUpdateCheckCache() {
    if (!(await fs.pathExists(UPDATE_CHECK_PATH))) {
        return null;
    }
    try {
        return await fs.readJson(UPDATE_CHECK_PATH);
    }
    catch {
        return null;
    }
}
async function writeUpdateCheckCache(cache) {
    await fs.ensureFile(UPDATE_CHECK_PATH);
    await fs.writeJson(UPDATE_CHECK_PATH, cache, { spaces: 2 });
}
async function getLatestReleaseInfo(cliVersion, options = {}) {
    const useCache = options.useCache !== false;
    if (useCache) {
        const cached = await readUpdateCheckCache();
        if (cached) {
            const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
            if (ageMs < UPDATE_CHECK_INTERVAL_MS) {
                return {
                    version: cached.latestVersion,
                    downloadUrl: cached.downloadUrl,
                    assets: [],
                };
            }
        }
    }
    const latest = await fetchLatestReleaseInfo(cliVersion);
    await writeUpdateCheckCache({
        checkedAt: new Date().toISOString(),
        latestVersion: latest.version,
        downloadUrl: latest.downloadUrl,
    });
    return latest;
}
async function maybeNotifyUpdate(cliVersion, options = {}) {
    if (process.env.TEST_SUBMIT_DIR_SKIP_UPDATE_CHECK === '1') {
        return;
    }
    try {
        const latest = await getLatestReleaseInfo(cliVersion, { useCache: true });
        if (compareVersions(latest.version, cliVersion) > 0) {
            if (!options.silent && !options.json && !options.quiet) {
                console.log(`ℹ️  Update available: v${latest.version} (current v${cliVersion}). Run 'ship self-update'.`);
            }
        }
    }
    catch {
        // Ignore update check failures silently.
    }
}
async function runSelfUpdate(cliVersion, options) {
    const latest = await getLatestReleaseInfo(cliVersion, { useCache: false });
    const runtimePlatform = process.env.TEST_SUBMIT_DIR_PLATFORM || process.platform;
    if (compareVersions(latest.version, cliVersion) <= 0) {
        return { success: true, updated: false, current: cliVersion, latest: latest.version };
    }
    if (runtimePlatform === 'win32') {
        throw new errors_1.CliError(`Self-update is not supported on Windows yet. Download v${latest.version} manually from https://github.com/${exports.RELEASE_REPO}/releases/latest`);
    }
    if (!latest.downloadUrl) {
        throw new errors_1.CliError(`No downloadable asset found for ${process.platform}/${process.arch}.`);
    }
    const executablePath = getExecutablePath();
    const tempPath = `${executablePath}.download`;
    await (0, http_1.downloadToFile)(latest.downloadUrl, tempPath, `ship/${cliVersion}`);
    await fs.chmod(tempPath, 0o755);
    await fs.move(tempPath, executablePath, { overwrite: true });
    await writeUpdateCheckCache({
        checkedAt: new Date().toISOString(),
        latestVersion: latest.version,
        downloadUrl: latest.downloadUrl,
    });
    return { success: true, updated: true, previous: cliVersion, current: latest.version };
}
