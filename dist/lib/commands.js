"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submit = submit;
exports.fetchPreview = fetchPreview;
const config_1 = require("./config");
const output_1 = require("./output");
const http_1 = require("./http");
const update_1 = require("./update");
const validators_1 = require("./validators");
async function submit(cliVersion, targetUrl, options) {
    try {
        await (0, update_1.maybeNotifyUpdate)(cliVersion, { json: options.json, quiet: options.quiet });
        const validUrl = (0, validators_1.validateUrl)(targetUrl);
        const config = await (0, config_1.loadConfig)({ site: options.site });
        if (!options.json && !options.quiet) {
            console.log(`Submitting ${validUrl} to ${config.baseUrl}...`);
        }
        const result = await (0, http_1.httpPost)(config.baseUrl, config.token, '/api/submit', { link: validUrl });
        (0, output_1.printResult)(result, options);
    }
    catch (error) {
        (0, output_1.printCommandError)(error, options);
    }
}
async function fetchPreview(cliVersion, targetUrl, options) {
    try {
        await (0, update_1.maybeNotifyUpdate)(cliVersion, { json: options.json, quiet: options.quiet });
        const validUrl = (0, validators_1.validateUrl)(targetUrl);
        const config = await (0, config_1.loadConfig)({ site: options.site });
        if (!options.json && !options.quiet) {
            console.log(`Fetching preview for ${validUrl} from ${config.baseUrl}...`);
        }
        const result = await (0, http_1.httpPost)(config.baseUrl, config.token, '/api/fetch-website', { link: validUrl });
        (0, output_1.printResult)(result, options);
    }
    catch (error) {
        (0, output_1.printCommandError)(error, options);
    }
}
