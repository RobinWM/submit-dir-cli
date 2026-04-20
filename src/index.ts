#!/usr/bin/env node

import { Command } from 'commander';
import { SUPPORTED_SITES } from './lib/sites';
import { login } from './lib/auth';
import { fetchPreview, submit } from './lib/commands';
import { selfUpdate, showVersion } from './lib/version';

const CLI_VERSION = require('../package.json').version as string;

const program = new Command();

program
  .name('ship')
  .description('CLI for shipping, submitting, and managing site growth workflows')
  .version(CLI_VERSION);

program
  .command('login')
  .description('Login via browser (supports aidirs.org and backlinkdirs.com)')
  .option('--site <site>', `Site to login to (${SUPPORTED_SITES.join(', ')})`)
  .action((options) => login(CLI_VERSION, options));

program
  .command('submit <url>')
  .description('Submit a URL to the selected site')
  .option('--site <site>', `Override configured site (${SUPPORTED_SITES.join(', ')})`)
  .option('--source <source>', 'Source label sent to the submit API', 'cli')
  .option('--json', 'Print machine-readable JSON output')
  .option('--quiet', 'Print only response payload')
  .action((targetUrl, options) => submit(CLI_VERSION, targetUrl, options));

program
  .command('fetch <url>')
  .description('Preview a URL without creating a record')
  .option('--site <site>', `Override configured site (${SUPPORTED_SITES.join(', ')})`)
  .option('--json', 'Print machine-readable JSON output')
  .option('--quiet', 'Print only response payload')
  .action((targetUrl, options) => fetchPreview(CLI_VERSION, targetUrl, options));

program
  .command('version')
  .description('Show current version information')
  .option('--latest', 'Fetch latest release information from GitHub')
  .option('--json', 'Print machine-readable JSON output')
  .action((options) => showVersion(CLI_VERSION, options));

program
  .command('self-update')
  .description('Download and install the latest release for this platform')
  .option('--json', 'Print machine-readable JSON output')
  .action((options) => selfUpdate(CLI_VERSION, options));

program.parse(process.argv);

if (process.argv.length === 2) {
  program.help();
}
