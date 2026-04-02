#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const crypto_1 = require("crypto");
const inquirer_1 = __importDefault(require("inquirer"));
const errors_1 = require("./lib/errors");
const config_1 = require("./lib/config");
const output_1 = require("./lib/output");
const sites_1 = require("./lib/sites");
const browser_1 = require("./lib/browser");
const callback_server_1 = require("./lib/callback-server");
const http_1 = require("./lib/http");
const update_1 = require("./lib/update");
const CLI_VERSION = require('../package.json').version;
function validateUrl(input) {
    let parsed;
    try {
        parsed = new URL(input);
    }
    catch {
        throw new errors_1.CliError(`Invalid URL: ${input}`, errors_1.EXIT_CODES.GENERAL_ERROR);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new errors_1.CliError(`Unsupported URL protocol: ${parsed.protocol}`, errors_1.EXIT_CODES.GENERAL_ERROR);
    }
    return parsed.toString();
}
async function promptForSite() {
    const inq = inquirer_1.default.createPromptModule();
    const { site } = await inq([
        {
            type: 'list',
            name: 'site',
            message: 'Which site do you want to login to?',
            choices: sites_1.SUPPORTED_SITES.map((value) => ({ name: value, value })),
        },
    ]);
    return site;
}
async function login(options) {
    await (0, update_1.maybeNotifyUpdate)(CLI_VERSION);
    const site = options.site
        ? (0, sites_1.normalizeSite)(options.site)
        : await promptForSite();
    const port = await (0, callback_server_1.getAvailablePort)(38492);
    const callbackUrl = `http://localhost:${port}/callback`;
    const state = (0, crypto_1.randomBytes)(24).toString('hex');
    const callbackWithState = `${callbackUrl}?state=${encodeURIComponent(state)}`;
    const authUrl = `${sites_1.SITE_AUTH_URLS[site]}?callback=${encodeURIComponent(callbackWithState)}`;
    console.log(`\n🔐 Opening browser to login to ${site}...`);
    console.log(`   Waiting for callback on localhost:${port}\n`);
    try {
        (0, browser_1.openBrowser)(authUrl);
    }
    catch (error) {
        console.error(`\n❌ Failed to open browser automatically.`);
        console.error(`Open this URL manually:`);
        console.error(authUrl);
        process.exit(error instanceof errors_1.CliError ? error.exitCode : errors_1.EXIT_CODES.AUTH_ERROR);
    }
    try {
        const { token } = await (0, callback_server_1.waitForCallback)(port, site, state);
        await (0, config_1.saveSiteConfig)(site, token);
        console.log(`\n✅ Login successful`);
    }
    catch (error) {
        console.error(`\n❌ Login failed: ${(0, errors_1.getErrorMessage)(error)}`);
        process.exit(error instanceof errors_1.CliError ? error.exitCode : errors_1.EXIT_CODES.AUTH_ERROR);
    }
}
async function showVersion(options) {
    try {
        const payload = { current: CLI_VERSION };
        if (options.latest) {
            const latest = await (0, update_1.getLatestReleaseInfo)(CLI_VERSION, { useCache: false });
            payload.latest = latest.version;
            payload.updateAvailable = (0, update_1.compareVersions)(latest.version, CLI_VERSION) > 0;
        }
        if (options.json) {
            (0, output_1.printJson)(payload);
            return;
        }
        console.log(`ship v${CLI_VERSION}`);
        if (options.latest && payload.latest) {
            console.log(`latest: v${payload.latest}`);
            if (payload.updateAvailable) {
                console.log('update available');
            }
        }
    }
    catch (error) {
        (0, output_1.printCommandError)(error, { json: options.json });
    }
}
async function selfUpdate(options) {
    try {
        const result = await (0, update_1.runSelfUpdate)(CLI_VERSION, options);
        if (options.json) {
            (0, output_1.printJson)(result);
        }
        else if (!result.updated) {
            console.log(`Already up to date (v${CLI_VERSION}).`);
        }
        else {
            console.log(`Updated ship from v${CLI_VERSION} to v${result.current}.`);
        }
    }
    catch (error) {
        (0, output_1.printCommandError)(error, { json: options.json });
    }
}
async function submit(targetUrl, options) {
    try {
        await (0, update_1.maybeNotifyUpdate)(CLI_VERSION, { json: options.json, quiet: options.quiet });
        const validUrl = validateUrl(targetUrl);
        const config = await (0, config_1.loadConfig)({ site: options.site });
        if (!options.json && !options.quiet) {
            console.log(`Submitting ${validUrl} to ${config.baseUrl}...`);
        }
        const result = await (0, http_1.httpPost)(config.baseUrl, config.token, '/api/submit', { link: validUrl });
        (0, output_1.printResult)(result, options);
    }
    catch (error) {
        (0, output_1.printCommandError)(error, options);
    }
}
async function fetchPreview(targetUrl, options) {
    try {
        await (0, update_1.maybeNotifyUpdate)(CLI_VERSION, { json: options.json, quiet: options.quiet });
        const validUrl = validateUrl(targetUrl);
        const config = await (0, config_1.loadConfig)({ site: options.site });
        if (!options.json && !options.quiet) {
            console.log(`Fetching preview for ${validUrl} from ${config.baseUrl}...`);
        }
        const result = await (0, http_1.httpPost)(config.baseUrl, config.token, '/api/fetch-website', { link: validUrl });
        (0, output_1.printResult)(result, options);
    }
    catch (error) {
        (0, output_1.printCommandError)(error, options);
    }
}
const program = new commander_1.Command();
program
    .name('ship')
    .description('CLI for shipping, submitting, and managing site growth workflows')
    .version(CLI_VERSION);
program
    .command('login')
    .description('Login via browser (supports aidirs.org and backlinkdirs.com)')
    .option('--site <site>', `Site to login to (${sites_1.SUPPORTED_SITES.join(', ')})`)
    .action(login);
program
    .command('submit <url>')
    .description('Submit a URL to the selected site')
    .option('--site <site>', `Override configured site (${sites_1.SUPPORTED_SITES.join(', ')})`)
    .option('--json', 'Print machine-readable JSON output')
    .option('--quiet', 'Print only response payload')
    .action(submit);
program
    .command('fetch <url>')
    .description('Preview a URL without creating a record')
    .option('--site <site>', `Override configured site (${sites_1.SUPPORTED_SITES.join(', ')})`)
    .option('--json', 'Print machine-readable JSON output')
    .option('--quiet', 'Print only response payload')
    .action(fetchPreview);
program
    .command('version')
    .description('Show current version information')
    .option('--latest', 'Fetch latest release information from GitHub')
    .option('--json', 'Print machine-readable JSON output')
    .action(showVersion);
program
    .command('self-update')
    .description('Download and install the latest release for this platform')
    .option('--json', 'Print machine-readable JSON output')
    .action(selfUpdate);
program.parse(process.argv);
if (process.argv.length === 2) {
    program.help();
}
