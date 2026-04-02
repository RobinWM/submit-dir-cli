"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_AUTH_URLS = exports.SITE_BASE_URLS = exports.SUPPORTED_SITES = exports.DEFAULT_SITE = void 0;
exports.normalizeSite = normalizeSite;
exports.normalizeBaseUrl = normalizeBaseUrl;
exports.getSiteFromBaseUrl = getSiteFromBaseUrl;
const errors_1 = require("./errors");
exports.DEFAULT_SITE = 'aidirs.org';
exports.SUPPORTED_SITES = ['aidirs.org', 'backlinkdirs.com'];
exports.SITE_BASE_URLS = {
    'aidirs.org': 'https://aidirs.org',
    'backlinkdirs.com': 'https://backlinkdirs.com',
};
exports.SITE_AUTH_URLS = {
    'aidirs.org': 'https://aidirs.org/api/cli/callback',
    'backlinkdirs.com': 'https://backlinkdirs.com/api/cli/callback',
};
function normalizeSite(site) {
    if (!site)
        return exports.DEFAULT_SITE;
    if (exports.SUPPORTED_SITES.includes(site)) {
        return site;
    }
    throw new errors_1.CliError(`Unsupported site '${site}'. Use one of: ${exports.SUPPORTED_SITES.join(', ')}`, errors_1.EXIT_CODES.GENERAL_ERROR);
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/$/, '');
}
function getSiteFromBaseUrl(baseUrl) {
    if (!baseUrl)
        return exports.DEFAULT_SITE;
    const normalized = normalizeBaseUrl(baseUrl);
    const matchedEntry = Object.entries(exports.SITE_BASE_URLS).find(([, value]) => value === normalized);
    return matchedEntry?.[0] ?? exports.DEFAULT_SITE;
}
