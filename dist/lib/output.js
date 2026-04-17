"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printJson = printJson;
exports.printResult = printResult;
exports.printCommandError = printCommandError;
const errors_1 = require("./errors");
function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/$/, '');
}
function withAbsoluteNextPath(data, baseUrl) {
    if (!baseUrl || !data || typeof data !== 'object' || Array.isArray(data)) {
        return data;
    }
    const record = data;
    const nextPath = record.nextPath;
    if (typeof nextPath !== 'string' || !nextPath.startsWith('/')) {
        return data;
    }
    return {
        ...record,
        nextPath: `${normalizeBaseUrl(baseUrl)}${nextPath}`,
    };
}
function printResult(result, options, baseUrl) {
    const normalizedData = withAbsoluteNextPath(result.data, baseUrl);
    if (options.json) {
        printJson({ success: true, status: result.status, data: normalizedData });
        return;
    }
    if (options.quiet) {
        if (typeof normalizedData === 'string') {
            console.log(normalizedData);
            return;
        }
        printJson(normalizedData);
        return;
    }
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(normalizedData, null, 2));
}
function printCommandError(error, options) {
    if (options.json) {
        const exitCode = error instanceof errors_1.CliError ? error.exitCode : errors_1.EXIT_CODES.GENERAL_ERROR;
        const payload = {
            success: false,
            error: (0, errors_1.getErrorMessage)(error),
            exitCode,
        };
        if (error instanceof errors_1.HttpError) {
            payload.status = error.status;
            payload.data = error.data;
        }
        printJson(payload);
    }
    else {
        console.error(`❌ Error: ${(0, errors_1.getErrorMessage)(error)}`);
        if (error instanceof errors_1.HttpError && error.data) {
            console.error(JSON.stringify(error.data, null, 2));
        }
    }
    process.exit(error instanceof errors_1.CliError ? error.exitCode : errors_1.EXIT_CODES.GENERAL_ERROR);
}
