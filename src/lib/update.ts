import * as fs from 'fs-extra';
import * as path from 'path';
import { CliError } from './errors';
import { downloadToFile, httpGetJson } from './http';

export const RELEASE_REPO = 'RobinWM/ship-cli';
const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
const UPDATE_CHECK_PATH = path.join(process.env.HOME || '', '.config', 'ship', 'update-check.json');
const UPDATE_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface UpdateCheckCache {
  checkedAt: string;
  latestVersion: string;
  downloadUrl?: string;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface LatestReleaseInfo {
  version: string;
  downloadUrl?: string;
  assets: ReleaseAsset[];
}

export function compareVersions(left: string, right: string): number {
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

export function getExecutablePath(): string {
  return fs.realpathSync(process.argv[1]);
}

function getReleaseAssetUrl(assets: ReleaseAsset[]): string | undefined {
  const assetName = detectPlatformAssetName();
  if (!assetName) return undefined;
  return assets.find((asset) => asset.name === assetName)?.browser_download_url;
}

async function fetchLatestReleaseInfo(cliVersion: string): Promise<LatestReleaseInfo> {
  if (process.env.TEST_SUBMIT_DIR_LATEST_VERSION) {
    return {
      version: process.env.TEST_SUBMIT_DIR_LATEST_VERSION,
      downloadUrl: process.env.TEST_SUBMIT_DIR_DOWNLOAD_URL,
      assets: [],
    };
  }

  const response = await httpGetJson<{ tag_name: string; assets?: ReleaseAsset[] }>(RELEASE_API_URL, `ship/${cliVersion}`);
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

export async function writeUpdateCheckCache(cache: UpdateCheckCache): Promise<void> {
  await fs.ensureFile(UPDATE_CHECK_PATH);
  await fs.writeJson(UPDATE_CHECK_PATH, cache, { spaces: 2 });
}

export async function getLatestReleaseInfo(cliVersion: string, options: { useCache?: boolean } = {}): Promise<LatestReleaseInfo> {
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

  const latest = await fetchLatestReleaseInfo(cliVersion);
  await writeUpdateCheckCache({
    checkedAt: new Date().toISOString(),
    latestVersion: latest.version,
    downloadUrl: latest.downloadUrl,
  });
  return latest;
}

export async function maybeNotifyUpdate(cliVersion: string, options: { silent?: boolean; json?: boolean; quiet?: boolean } = {}): Promise<void> {
  if (process.env.TEST_SUBMIT_DIR_SKIP_UPDATE_CHECK === '1') {
    return;
  }

  try {
    const latest = await getLatestReleaseInfo(cliVersion, { useCache: true });
    if (compareVersions(latest.version, cliVersion) > 0) {
      if (!options.silent && !options.json && !options.quiet) {
        console.log(`ℹ️  Update available: v${latest.version} (current v${cliVersion}). Run 'ship self-update'.`);
      }
    }
  } catch {
    // Ignore update check failures silently.
  }
}

export async function runSelfUpdate(cliVersion: string, options: { json?: boolean }): Promise<{ success: true; updated: boolean; previous?: string; current: string; latest?: string }> {
  const latest = await getLatestReleaseInfo(cliVersion, { useCache: false });
  const runtimePlatform = process.env.TEST_SUBMIT_DIR_PLATFORM || process.platform;

  if (compareVersions(latest.version, cliVersion) <= 0) {
    return { success: true, updated: false, current: cliVersion, latest: latest.version };
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
  await downloadToFile(latest.downloadUrl, tempPath, `ship/${cliVersion}`);
  await fs.chmod(tempPath, 0o755);
  await fs.move(tempPath, executablePath, { overwrite: true });
  await writeUpdateCheckCache({
    checkedAt: new Date().toISOString(),
    latestVersion: latest.version,
    downloadUrl: latest.downloadUrl,
  });

  return { success: true, updated: true, previous: cliVersion, current: latest.version };
}
