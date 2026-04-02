import { execFileSync } from 'child_process';
import { CliError } from './errors';

export function tryOpen(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function openBrowser(url: string) {
  const platform = process.platform;

  if (platform === 'darwin') {
    if (tryOpen('open', [url])) return;
    throw new CliError('Failed to open browser with macOS open command.');
  }

  if (platform === 'linux') {
    if (tryOpen('xdg-open', [url])) return;
    throw new CliError('Failed to open browser with xdg-open.');
  }

  if (platform === 'win32') {
    if (tryOpen('rundll32', ['url.dll,FileProtocolHandler', url])) return;
    if (tryOpen('cmd', ['/c', 'start', '', url])) return;
    throw new CliError('Failed to open browser on Windows. Try opening the login URL manually.');
  }

  throw new CliError(`Unsupported platform: ${platform}`);
}
