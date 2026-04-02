"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUrl = validateUrl;
const errors_1 = require("./errors");
function validateUrl(input) {
    let parsed;
    try {
        parsed = new URL(input);
    }
    catch {
        throw new errors_1.CliError(`Invalid URL: ${input}`, errors_1.EXIT_CODES.GENERAL_ERROR);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new errors_1.CliError(`Unsupported URL protocol: ${parsed.protocol}`, errors_1.EXIT_CODES.GENERAL_ERROR);
    }
    return parsed.toString();
}
