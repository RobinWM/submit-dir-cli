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
exports.CONFIG_PATH = void 0;
exports.readConfigFile = readConfigFile;
exports.writeConfig = writeConfig;
exports.loadConfig = loadConfig;
exports.saveSiteConfig = saveSiteConfig;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const errors_1 = require("./errors");
const sites_1 = require("./sites");
exports.CONFIG_PATH = path.join(process.env.HOME || '', '.config', 'ship', 'config.json');
async function readConfigFile() {
    if (!(await fs.pathExists(exports.CONFIG_PATH))) {
        return null;
    }
    const rawConfig = (await fs.readJson(exports.CONFIG_PATH));
    if (rawConfig.sites && rawConfig.currentSite) {
        return {
            currentSite: (0, sites_1.normalizeSite)(rawConfig.currentSite),
            sites: rawConfig.sites,
        };
    }
    const legacyToken = rawConfig.DIRS_TOKEN;
    if (!legacyToken) {
        return null;
    }
    const legacySite = (0, sites_1.getSiteFromBaseUrl)(rawConfig.DIRS_BASE_URL);
    return {
        currentSite: legacySite,
        sites: {
            [legacySite]: {
                token: legacyToken,
                baseUrl: sites_1.SITE_BASE_URLS[legacySite],
            },
        },
    };
}
async function writeConfig(config) {
    await fs.ensureFile(exports.CONFIG_PATH);
    await fs.writeJson(exports.CONFIG_PATH, config, { spaces: 2 });
}
async function loadConfig(options = {}) {
    const envToken = process.env.DIRS_TOKEN;
    const envBaseUrl = process.env.DIRS_BASE_URL;
    const requestedSite = options.site ? (0, sites_1.normalizeSite)(options.site) : undefined;
    const fileConfig = await readConfigFile();
    const site = requestedSite ?? fileConfig?.currentSite ?? (0, sites_1.getSiteFromBaseUrl)(envBaseUrl);
    const siteFromFile = fileConfig?.sites?.[site];
    const token = siteFromFile?.token || envToken || '';
    const baseUrl = (0, sites_1.normalizeBaseUrl)(siteFromFile?.baseUrl || envBaseUrl || sites_1.SITE_BASE_URLS[site]);
    if (!token) {
        throw new errors_1.CliError(`No token configured for ${site}. Run 'ship login --site ${site}' first or set DIRS_TOKEN.`, errors_1.EXIT_CODES.AUTH_ERROR);
    }
    return { site, token, baseUrl };
}
async function saveSiteConfig(site, token) {
    const existing = (await readConfigFile()) ?? {
        currentSite: site,
        sites: {},
    };
    const nextConfig = {
        currentSite: site,
        sites: {
            ...existing.sites,
            [site]: {
                token,
                baseUrl: sites_1.SITE_BASE_URLS[site],
            },
        },
    };
    await writeConfig(nextConfig);
}
