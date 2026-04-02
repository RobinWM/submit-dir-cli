"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showVersion = showVersion;
exports.selfUpdate = selfUpdate;
const output_1 = require("./output");
const update_1 = require("./update");
async function showVersion(cliVersion, options) {
    try {
        const payload = { current: cliVersion };
        if (options.latest) {
            const latest = await (0, update_1.getLatestReleaseInfo)(cliVersion, { useCache: false });
            payload.latest = latest.version;
            payload.updateAvailable = (0, update_1.compareVersions)(latest.version, cliVersion) > 0;
        }
        if (options.json) {
            (0, output_1.printJson)(payload);
            return;
        }
        console.log(`ship v${cliVersion}`);
        if (options.latest && payload.latest) {
            console.log(`latest: v${payload.latest}`);
            if (payload.updateAvailable) {
                console.log('update available');
            }
        }
    }
    catch (error) {
        (0, output_1.printCommandError)(error, { json: options.json });
    }
}
async function selfUpdate(cliVersion, options) {
    try {
        const result = await (0, update_1.runSelfUpdate)(cliVersion, options);
        if (options.json) {
            (0, output_1.printJson)(result);
        }
        else if (!result.updated) {
            console.log(`Already up to date (v${cliVersion}).`);
        }
        else {
            console.log(`Updated ship from v${cliVersion} to v${result.current}.`);
        }
    }
    catch (error) {
        (0, output_1.printCommandError)(error, { json: options.json });
    }
}
