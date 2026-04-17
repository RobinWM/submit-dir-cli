import { CliError, EXIT_CODES, getErrorMessage, HttpError } from './errors';

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
}

export interface CommandOutputOptions {
  json?: boolean;
  quiet?: boolean;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function withAbsoluteNextPath<T>(data: T, baseUrl?: string): T {
  if (!baseUrl || !data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const record = data as Record<string, unknown>;
  const nextPath = record.nextPath;
  if (typeof nextPath !== 'string' || !nextPath.startsWith('/')) {
    return data;
  }

  return {
    ...record,
    nextPath: `${normalizeBaseUrl(baseUrl)}${nextPath}`,
  } as T;
}

export function printResult(result: HttpResponse, options: CommandOutputOptions, baseUrl?: string): void {
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

export function printCommandError(error: unknown, options: CommandOutputOptions): never {
  if (options.json) {
    const exitCode = error instanceof CliError ? error.exitCode : EXIT_CODES.GENERAL_ERROR;
    const payload: Record<string, unknown> = {
      success: false,
      error: getErrorMessage(error),
      exitCode,
    };

    if (error instanceof HttpError) {
      payload.status = error.status;
      payload.data = error.data;
    }

    printJson(payload);
  } else {
    console.error(`❌ Error: ${getErrorMessage(error)}`);
    if (error instanceof HttpError && error.data) {
      console.error(JSON.stringify(error.data, null, 2));
    }
  }

  process.exit(error instanceof CliError ? error.exitCode : EXIT_CODES.GENERAL_ERROR);
}
