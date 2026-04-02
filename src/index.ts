#!/usr/bin/env node

import { Command } from 'commander';
import { randomBytes } from 'crypto';
import inquirer from 'inquirer';
import { CliError, EXIT_CODES, getErrorMessage } from './lib/errors';
import { loadConfig, saveSiteConfig } from './lib/config';
import { CommandOutputOptions, HttpResponse, printCommandError, printJson, printResult } from './lib/output';
import { normalizeSite, SITE_AUTH_URLS, SUPPORTED_SITES, SupportedSite } from './lib/sites';
import { openBrowser } from './lib/browser';
import { getAvailablePort, waitForCallback } from './lib/callback-server';
import { httpPost } from './lib/http';
import { compareVersions, getLatestReleaseInfo, maybeNotifyUpdate, RELEASE_REPO, runSelfUpdate } from './lib/update';

const CLI_VERSION = require('../package.json').version as string;

function validateUrl(input: string): string {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new CliError(`Invalid URL: ${input}`, EXIT_CODES.GENERAL_ERROR);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new CliError(`Unsupported URL protocol: ${parsed.protocol}`, EXIT_CODES.GENERAL_ERROR);
  }

  return parsed.toString();
}

async function promptForSite(): Promise<SupportedSite> {
  const inq = (inquirer as unknown as { createPromptModule: () => (questions: unknown[]) => Promise<{ site: SupportedSite }> }).createPromptModule();
  const { site } = await inq([
    {
      type: 'list',
      name: 'site',
      message: 'Which site do you want to login to?',
      choices: SUPPORTED_SITES.map((value) => ({ name: value, value })),
    },
  ]);

  return site;
}

async function login(options: { site?: string }) {
  await maybeNotifyUpdate(CLI_VERSION);

  const site = options.site
    ? normalizeSite(options.site)
    : await promptForSite();

  const port = await getAvailablePort(38492);
  const callbackUrl = `http://localhost:${port}/callback`;
  const state = randomBytes(24).toString('hex');
  const callbackWithState = `${callbackUrl}?state=${encodeURIComponent(state)}`;
  const authUrl = `${SITE_AUTH_URLS[site]}?callback=${encodeURIComponent(callbackWithState)}`;

  console.log(`\n🔐 Opening browser to login to ${site}...`);
  console.log(`   Waiting for callback on localhost:${port}\n`);

  try {
    openBrowser(authUrl);
  } catch (error: unknown) {
    console.error(`\n❌ Failed to open browser automatically.`);
    console.error(`Open this URL manually:`);
    console.error(authUrl);
    process.exit(error instanceof CliError ? error.exitCode : EXIT_CODES.AUTH_ERROR);
  }

  try {
    const { token } = await waitForCallback(port, site, state);
    await saveSiteConfig(site, token);
    console.log(`\n✅ Login successful`);
  } catch (error: unknown) {
    console.error(`\n❌ Login failed: ${getErrorMessage(error)}`);
    process.exit(error instanceof CliError ? error.exitCode : EXIT_CODES.AUTH_ERROR);
  }
}

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

async function submit(targetUrl: string, options: { site?: string; json?: boolean; quiet?: boolean }) {
  try {
    await maybeNotifyUpdate(CLI_VERSION, { json: options.json, quiet: options.quiet });
    const validUrl = validateUrl(targetUrl);
    const config = await loadConfig({ site: options.site });

    if (!options.json && !options.quiet) {
      console.log(`Submitting ${validUrl} to ${config.baseUrl}...`);
    }

    const result: HttpResponse = await httpPost(config.baseUrl, config.token, '/api/submit', { link: validUrl });
    printResult(result, options);
  } catch (error: unknown) {
    printCommandError(error, options);
  }
}

async function fetchPreview(targetUrl: string, options: { site?: string; json?: boolean; quiet?: boolean }) {
  try {
    await maybeNotifyUpdate(CLI_VERSION, { json: options.json, quiet: options.quiet });
    const validUrl = validateUrl(targetUrl);
    const config = await loadConfig({ site: options.site });

    if (!options.json && !options.quiet) {
      console.log(`Fetching preview for ${validUrl} from ${config.baseUrl}...`);
    }

    const result: HttpResponse = await httpPost(config.baseUrl, config.token, '/api/fetch-website', { link: validUrl });
    printResult(result, options);
  } catch (error: unknown) {
    printCommandError(error, options);
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
  .action(login);

program
  .command('submit <url>')
  .description('Submit a URL to the selected site')
  .option('--site <site>', `Override configured site (${SUPPORTED_SITES.join(', ')})`)
  .option('--json', 'Print machine-readable JSON output')
  .option('--quiet', 'Print only response payload')
  .action(submit);

program
  .command('fetch <url>')
  .description('Preview a URL without creating a record')
  .option('--site <site>', `Override configured site (${SUPPORTED_SITES.join(', ')})`)
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
