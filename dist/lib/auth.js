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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const crypto_1 = require("crypto");
const readline = __importStar(require("readline/promises"));
const process_1 = require("process");
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
async function promptForManualCallback(expectedSite, expectedState) {
    const rl = readline.createInterface({ input: process_1.stdin, output: process_1.stdout });
    try {
        while (true) {
            const callbackInput = await rl.question('\nPaste the localhost callback URL after login (required):\n');
            const trimmed = callbackInput.trim();
            if (!trimmed) {
                console.error('Callback URL is required. Paste the full localhost callback URL from your browser.');
                continue;
            }
            try {
                const callbackUrl = new URL(trimmed);
                const token = callbackUrl.searchParams.get('token');
                const site = (0, sites_1.normalizeSite)(callbackUrl.searchParams.get('site') || expectedSite);
                const state = callbackUrl.searchParams.get('state');
                const error = callbackUrl.searchParams.get('error');
                if (state !== expectedState) {
                    throw new errors_1.CliError('Login failed: invalid callback state.', errors_1.EXIT_CODES.AUTH_ERROR);
                }
                if (site !== expectedSite) {
                    throw new errors_1.CliError('Login failed: callback site mismatch.', errors_1.EXIT_CODES.AUTH_ERROR);
                }
                if (error) {
                    throw new errors_1.CliError(error, errors_1.EXIT_CODES.AUTH_ERROR);
                }
                if (!token) {
                    throw new errors_1.CliError('Login failed: missing token in callback URL.', errors_1.EXIT_CODES.AUTH_ERROR);
                }
                return { token, site };
            }
            catch (error) {
                if (error instanceof errors_1.CliError) {
                    throw error;
                }
                console.error(`Invalid callback URL: ${(0, errors_1.getErrorMessage)(error)}`);
            }
        }
    }
    finally {
        rl.close();
    }
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
    const authUrl = `${sites_1.SITE_AUTH_URLS[site]}?callback=${encodeURIComponent(callbackWithState)}&site=${encodeURIComponent(site)}`;
    console.log(`\n🔐 Opening browser to login to ${site}...`);
    console.log(`   Waiting for callback on localhost:${port}\n`);
    const shouldOpenBrowser = process.platform !== 'linux';
    let browserOpened = false;
    if (shouldOpenBrowser) {
        try {
            (0, browser_1.openBrowser)(authUrl);
            browserOpened = true;
        }
        catch {
            console.error(`\n❌ Failed to open browser automatically.`);
            console.error(`Open this URL manually:`);
            console.error(authUrl);
            console.error(`\nAfter login, copy the final localhost callback URL from your browser and paste it here.`);
        }
    }
    else {
        console.log(`Open this URL manually:`);
        console.log(authUrl);
        console.log(`\nAfter login, copy the final localhost callback URL from your browser and paste it here.`);
    }
    try {
        const result = browserOpened
            ? await (0, callback_server_1.waitForCallback)(port, site, state)
            : await promptForManualCallback(site, state);
        await (0, config_1.saveSiteConfig)(site, result.token);
        console.log(`\n✅ Login successful`);
    }
    catch (error) {
        console.error(`\n❌ Login failed: ${(0, errors_1.getErrorMessage)(error)}`);
        process.exit(error instanceof errors_1.CliError ? error.exitCode : errors_1.EXIT_CODES.AUTH_ERROR);
    }
}
