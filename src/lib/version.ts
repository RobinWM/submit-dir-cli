import { printCommandError, printJson } from './output';
import { compareVersions, getLatestReleaseInfo, runSelfUpdate } from './update';

export async function showVersion(cliVersion: string, options: { latest?: boolean; json?: boolean }) {
  try {
    const payload: Record<string, unknown> = { current: cliVersion };

    if (options.latest) {
      const latest = await getLatestReleaseInfo(cliVersion, { useCache: false });
      payload.latest = latest.version;
      payload.updateAvailable = compareVersions(latest.version, cliVersion) > 0;
    }

    if (options.json) {
      printJson(payload);
      return;
    }

    console.log(`ship v${cliVersion}`);
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

export async function selfUpdate(cliVersion: string, options: { json?: boolean }) {
  try {
    const result = await runSelfUpdate(cliVersion, options);

    if (options.json) {
      printJson(result);
    } else if (!result.updated) {
      console.log(`Already up to date (v${cliVersion}).`);
    } else {
      console.log(`Updated ship from v${cliVersion} to v${result.current}.`);
    }
  } catch (error: unknown) {
    printCommandError(error, { json: options.json });
  }
}
