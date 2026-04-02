#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const output_1 = require("./lib/output");
const sites_1 = require("./lib/sites");
const update_1 = require("./lib/update");
const auth_1 = require("./lib/auth");
const commands_1 = require("./lib/commands");
const CLI_VERSION = require('../package.json').version;
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
const program = new commander_1.Command();
program
    .name('ship')
    .description('CLI for shipping, submitting, and managing site growth workflows')
    .version(CLI_VERSION);
program
    .command('login')
    .description('Login via browser (supports aidirs.org and backlinkdirs.com)')
    .option('--site <site>', `Site to login to (${sites_1.SUPPORTED_SITES.join(', ')})`)
    .action((options) => (0, auth_1.login)(CLI_VERSION, options));
program
    .command('submit <url>')
    .description('Submit a URL to the selected site')
    .option('--site <site>', `Override configured site (${sites_1.SUPPORTED_SITES.join(', ')})`)
    .option('--json', 'Print machine-readable JSON output')
    .option('--quiet', 'Print only response payload')
    .action((targetUrl, options) => (0, commands_1.submit)(CLI_VERSION, targetUrl, options));
program
    .command('fetch <url>')
    .description('Preview a URL without creating a record')
    .option('--site <site>', `Override configured site (${sites_1.SUPPORTED_SITES.join(', ')})`)
    .option('--json', 'Print machine-readable JSON output')
    .option('--quiet', 'Print only response payload')
    .action((targetUrl, options) => (0, commands_1.fetchPreview)(CLI_VERSION, targetUrl, options));
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
