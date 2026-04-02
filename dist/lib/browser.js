"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryOpen = tryOpen;
exports.openBrowser = openBrowser;
const child_process_1 = require("child_process");
const errors_1 = require("./errors");
function tryOpen(command, args) {
    try {
        (0, child_process_1.execFileSync)(command, args, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function openBrowser(url) {
    const platform = process.platform;
    if (platform === 'darwin') {
        if (tryOpen('open', [url]))
            return;
        throw new errors_1.CliError('Failed to open browser with macOS open command.');
    }
    if (platform === 'linux') {
        if (tryOpen('xdg-open', [url]))
            return;
        throw new errors_1.CliError('Failed to open browser with xdg-open.');
    }
    if (platform === 'win32') {
        if (tryOpen('rundll32', ['url.dll,FileProtocolHandler', url]))
            return;
        if (tryOpen('cmd', ['/c', 'start', '', url]))
            return;
        throw new errors_1.CliError('Failed to open browser on Windows. Try opening the login URL manually.');
    }
    throw new errors_1.CliError(`Unsupported platform: ${platform}`);
}
