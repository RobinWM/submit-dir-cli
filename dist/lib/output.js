"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printJson = printJson;
exports.printResult = printResult;
exports.printCommandError = printCommandError;
const errors_1 = require("./errors");
function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
function printResult(result, options) {
    if (options.json) {
        printJson({ success: true, status: result.status, data: result.data });
        return;
    }
    if (options.quiet) {
        if (typeof result.data === 'string') {
            console.log(result.data);
            return;
        }
        printJson(result.data);
        return;
    }
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
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
