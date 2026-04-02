#!/usr/bin/env node

import { Command } from 'commander';
import { printCommandError, printJson } from './lib/output';
import { SUPPORTED_SITES } from './lib/sites';
import { compareVersions, getLatestReleaseInfo, runSelfUpdate } from './lib/update';
import { login } from './lib/auth';
import { fetchPreview, submit } from './lib/commands';

const CLI_VERSION = require('../package.json').version as string;

async function showVersion(options: { latest?: boolean; json?: boolean }) {
  try {
    const payload: Record<string, unknown> = { current: CLI_VERSION };

    if (options.latest) {
      const latest = await getLatestReleaseInfo(CLI_VERSION, { useCache: false });
      payload.latest = latest.version;
      payload.updateAvailable = compareVersions(latest.version, CLI_VERSION) > 0;
    }

    if (options.json) {
      printJson(payload);
      return;
    }

    console.log(`ship v${CLI_VERSION}`);
    if (options.latest && payload.latest) {
      console.log(`latest: v${payload.latest}`);
      if (payload.updateAvailable) {
        console.log('update available');
      }
    }
  } catch (error: unknown) {
    printCommandError(error, { json: options.json });
  }
}

async function selfUpdate(options: { json?: boolean }) {
  try {
    const result = await runSelfUpdate(CLI_VERSION, options);

    if (options.json) {
      printJson(result);
    } else if (!result.updated) {
      console.log(`Already up to date (v${CLI_VERSION}).`);
    } else {
      console.log(`Updated ship from v${CLI_VERSION} to v${result.current}.`);
    }
  } catch (error: unknown) {
    printCommandError(error, { json: options.json });
  }
}

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
