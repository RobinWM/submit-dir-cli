import { randomBytes } from 'crypto';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import inquirer from 'inquirer';
import { CliError, EXIT_CODES, getErrorMessage } from './errors';
import { saveSiteConfig } from './config';
import { normalizeSite, SITE_AUTH_URLS, SUPPORTED_SITES, SupportedSite } from './sites';
import { openBrowser } from './browser';
import { getAvailablePort, waitForCallback } from './callback-server';
import { maybeNotifyUpdate } from './update';

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

async function promptForManualCallback(expectedSite: SupportedSite, expectedState: string): Promise<{ token: string; site: SupportedSite }> {
  const rl = readline.createInterface({ input, output });

  try {
    const callbackInput = await rl.question('\nPaste the localhost callback URL after login:\n');
    const callbackUrl = new URL(callbackInput.trim());
    const token = callbackUrl.searchParams.get('token');
    const site = normalizeSite(callbackUrl.searchParams.get('site') || expectedSite);
    const state = callbackUrl.searchParams.get('state');
    const error = callbackUrl.searchParams.get('error');

    if (state !== expectedState) {
      throw new CliError('Login failed: invalid callback state.', EXIT_CODES.AUTH_ERROR);
    }

    if (site !== expectedSite) {
      throw new CliError('Login failed: callback site mismatch.', EXIT_CODES.AUTH_ERROR);
    }

    if (error) {
      throw new CliError(error, EXIT_CODES.AUTH_ERROR);
    }

    if (!token) {
      throw new CliError('Login failed: missing token in callback URL.', EXIT_CODES.AUTH_ERROR);
    }

    return { token, site };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    throw new CliError(`Invalid callback URL: ${getErrorMessage(error)}`, EXIT_CODES.AUTH_ERROR);
  } finally {
    rl.close();
  }
}

export async function login(cliVersion: string, options: { site?: string }) {
  await maybeNotifyUpdate(cliVersion);

  const site = options.site
    ? normalizeSite(options.site)
    : await promptForSite();

  const port = await getAvailablePort(38492);
  const callbackUrl = `http://localhost:${port}/callback`;
  const state = randomBytes(24).toString('hex');
  const callbackWithState = `${callbackUrl}?state=${encodeURIComponent(state)}`;
  const authUrl = `${SITE_AUTH_URLS[site]}?callback=${encodeURIComponent(callbackWithState)}&site=${encodeURIComponent(site)}`;

  console.log(`\n🔐 Opening browser to login to ${site}...`);
  console.log(`   Waiting for callback on localhost:${port}\n`);

  const shouldOpenBrowser = process.platform !== 'linux';
  let browserOpened = false;

  if (shouldOpenBrowser) {
    try {
      openBrowser(authUrl);
      browserOpened = true;
    } catch {
      console.error(`\n❌ Failed to open browser automatically.`);
      console.error(`Open this URL manually:`);
      console.error(authUrl);
      console.error(`\nAfter login, copy the final localhost callback URL from your browser and paste it here.`);
    }
  } else {
    console.log(`Open this URL manually:`);
    console.log(authUrl);
    console.log(`\nAfter login, copy the final localhost callback URL from your browser and paste it here.`);
  }

  try {
    const result = browserOpened
      ? await waitForCallback(port, site, state)
      : await promptForManualCallback(site, state);
    await saveSiteConfig(site, result.token);
    console.log(`\n✅ Login successful`);
  } catch (error: unknown) {
    console.error(`\n❌ Login failed: ${getErrorMessage(error)}`);
    process.exit(error instanceof CliError ? error.exitCode : EXIT_CODES.AUTH_ERROR);
  }
}
