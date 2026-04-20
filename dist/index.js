#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const sites_1 = require("./lib/sites");
const auth_1 = require("./lib/auth");
const commands_1 = require("./lib/commands");
const version_1 = require("./lib/version");
const CLI_VERSION = require('../package.json').version;
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
    .option('--source <source>', 'Source label sent to the submit API', 'cli')
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
    .action((options) => (0, version_1.showVersion)(CLI_VERSION, options));
program
    .command('self-update')
    .description('Download and install the latest release for this platform')
    .option('--json', 'Print machine-readable JSON output')
    .action((options) => (0, version_1.selfUpdate)(CLI_VERSION, options));
program.parse(process.argv);
if (process.argv.length === 2) {
    program.help();
}
