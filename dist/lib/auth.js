"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const crypto_1 = require("crypto");
const inquirer_1 = __importDefault(require("inquirer"));
const errors_1 = require("./errors");
const config_1 = require("./config");
const sites_1 = require("./sites");
const browser_1 = require("./browser");
const callback_server_1 = require("./callback-server");
const update_1 = require("./update");
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
async function login(cliVersion, options) {
    await (0, update_1.maybeNotifyUpdate)(cliVersion);
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
