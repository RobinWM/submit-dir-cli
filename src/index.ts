#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { randomBytes } from 'crypto';
import inquirer from 'inquirer';
import { CliError, EXIT_CODES, getErrorMessage } from './lib/errors';
import { CONFIG_PATH, loadConfig, saveSiteConfig } from './lib/config';
import { CommandOutputOptions, HttpResponse, printCommandError, printJson, printResult } from './lib/output';
import { DEFAULT_SITE, getSiteFromBaseUrl, normalizeBaseUrl, normalizeSite, SITE_AUTH_URLS, SITE_BASE_URLS, SUPPORTED_SITES, SupportedSite } from './lib/sites';
import { openBrowser } from './lib/browser';
import { getAvailablePort, waitForCallback } from './lib/callback-server';
import { downloadToFile, httpGetJson, httpPost } from './lib/http';

const CLI_VERSION = require('../package.json').version as string;
const RELEASE_REPO = 'RobinWM/ship-cli';
const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
const UPDATE_CHECK_PATH = path.join(process.env.HOME || '', '.config', 'ship', 'update-check.json');
const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

interface UpdateCheckCache {
  checkedAt: string;
  latestVersion: string;
  downloadUrl?: string;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface LatestReleaseInfo {
  version: string;
  downloadUrl?: string;
  assets: ReleaseAsset[];
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

function detectPlatformAssetName(): string | null {
  const platform = process.env.TEST_SUBMIT_DIR_PLATFORM || process.platform;
  const arch = process.env.TEST_SUBMIT_DIR_ARCH || process.arch;

  if (platform === 'linux') {
    if (arch === 'x64') return 'ship-linux-x64';
    if (arch === 'arm64') return 'ship-linux-arm64';
  }

  if (platform === 'darwin') {
    if (arch === 'x64') return 'ship-darwin-x64';
    if (arch === 'arm64') return 'ship-darwin-arm64';
  }

  return null;
}

function getExecutablePath(): string {
  return fs.realpathSync(process.argv[1]);
}

function getReleaseAssetUrl(assets: ReleaseAsset[]): string | undefined {
  const assetName = detectPlatformAssetName();
  if (!assetName) return undefined;
  return assets.find((asset) => asset.name === assetName)?.browser_download_url;
}

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

async function fetchLatestReleaseInfo(): Promise<LatestReleaseInfo> {
  if (process.env.TEST_SUBMIT_DIR_LATEST_VERSION) {
    return {
      version: process.env.TEST_SUBMIT_DIR_LATEST_VERSION,
      downloadUrl: process.env.TEST_SUBMIT_DIR_DOWNLOAD_URL,
      assets: [],
    };
  }

  const response = await httpGetJson<{ tag_name: string; assets?: ReleaseAsset[] }>(RELEASE_API_URL, `ship/${CLI_VERSION}`);
  const version = response.tag_name.replace(/^v/, '');
  const assets = response.assets ?? [];
  return {
    version,
    assets,
    downloadUrl: getReleaseAssetUrl(assets),
  };
}

async function readUpdateCheckCache(): Promise<UpdateCheckCache | null> {
  if (!(await fs.pathExists(UPDATE_CHECK_PATH))) {
    return null;
  }

  try {
    return await fs.readJson(UPDATE_CHECK_PATH) as UpdateCheckCache;
  } catch {
    return null;
  }
}

async function writeUpdateCheckCache(cache: UpdateCheckCache): Promise<void> {
  await fs.ensureFile(UPDATE_CHECK_PATH);
  await fs.writeJson(UPDATE_CHECK_PATH, cache, { spaces: 2 });
}

async function getLatestReleaseInfo(options: { useCache?: boolean } = {}): Promise<LatestReleaseInfo> {
  const useCache = options.useCache !== false;
  if (useCache) {
    const cached = await readUpdateCheckCache();
    if (cached) {
      const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
      if (ageMs < UPDATE_CHECK_INTERVAL_MS) {
        return {
          version: cached.latestVersion,
          downloadUrl: cached.downloadUrl,
          assets: [],
        };
      }
    }
  }

  const latest = await fetchLatestReleaseInfo();
  await writeUpdateCheckCache({
    checkedAt: new Date().toISOString(),
    latestVersion: latest.version,
    downloadUrl: latest.downloadUrl,
  });
  return latest;
}

async function maybeNotifyUpdate(options: { silent?: boolean; json?: boolean; quiet?: boolean } = {}): Promise<void> {
  if (process.env.TEST_SUBMIT_DIR_SKIP_UPDATE_CHECK === '1') {
    return;
  }

  try {
    const latest = await getLatestReleaseInfo({ useCache: true });
    if (compareVersions(latest.version, CLI_VERSION) > 0) {
      if (!options.silent && !options.json && !options.quiet) {
        console.log(`ℹ️  Update available: v${latest.version} (current v${CLI_VERSION}). Run 'ship self-update'.`);
      }
    }
  } catch {
    // Ignore update check failures silently.
  }
}

async function login(options: { site?: string }) {
  await maybeNotifyUpdate();

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
      const latest = await getLatestReleaseInfo({ useCache: false });
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
    const latest = await getLatestReleaseInfo({ useCache: false });
    const runtimePlatform = process.env.TEST_SUBMIT_DIR_PLATFORM || process.platform;

    if (compareVersions(latest.version, CLI_VERSION) <= 0) {
      if (options.json) {
        printJson({ success: true, updated: false, current: CLI_VERSION, latest: latest.version });
      } else {
        console.log(`Already up to date (v${CLI_VERSION}).`);
      }
      return;
    }

    if (runtimePlatform === 'win32') {
      throw new CliError(
        `Self-update is not supported on Windows yet. Download v${latest.version} manually from https://github.com/${RELEASE_REPO}/releases/latest`,
      );
    }

    if (!latest.downloadUrl) {
      throw new CliError(`No downloadable asset found for ${process.platform}/${process.arch}.`);
    }

    const executablePath = getExecutablePath();
    const tempPath = `${executablePath}.download`;
    await downloadToFile(latest.downloadUrl, tempPath, `ship/${CLI_VERSION}`);
    await fs.chmod(tempPath, 0o755);
    await fs.move(tempPath, executablePath, { overwrite: true });
    await writeUpdateCheckCache({
      checkedAt: new Date().toISOString(),
      latestVersion: latest.version,
      downloadUrl: latest.downloadUrl,
    });

    if (options.json) {
      printJson({ success: true, updated: true, previous: CLI_VERSION, current: latest.version });
    } else {
      console.log(`Updated ship from v${CLI_VERSION} to v${latest.version}.`);
    }
  } catch (error: unknown) {
    printCommandError(error, { json: options.json });
  }
}

async function submit(targetUrl: string, options: { site?: string; json?: boolean; quiet?: boolean }) {
  try {
    await maybeNotifyUpdate({ json: options.json, quiet: options.quiet });
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
    await maybeNotifyUpdate({ json: options.json, quiet: options.quiet });
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
