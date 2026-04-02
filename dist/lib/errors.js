"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = exports.CliError = exports.EXIT_CODES = void 0;
exports.getErrorMessage = getErrorMessage;
exports.EXIT_CODES = {
    GENERAL_ERROR: 1,
    AUTH_ERROR: 2,
    NETWORK_ERROR: 3,
    API_ERROR: 4,
};
class CliError extends Error {
    constructor(message, exitCode = exports.EXIT_CODES.GENERAL_ERROR) {
        super(message);
        this.exitCode = exitCode;
        this.name = 'CliError';
    }
}
exports.CliError = CliError;
class HttpError extends CliError {
    constructor(message, status, data, exitCode = exports.EXIT_CODES.API_ERROR) {
        super(message, exitCode);
        this.status = status;
        this.data = data;
        this.name = 'HttpError';
    }
}
exports.HttpError = HttpError;
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
