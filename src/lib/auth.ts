import { randomBytes } from 'crypto';
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

export async function login(cliVersion: string, options: { site?: string }) {
  await maybeNotifyUpdate(cliVersion);

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
