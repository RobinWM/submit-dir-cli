import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { CliError, EXIT_CODES, getErrorMessage, HttpError } from './errors';

export const REQUEST_TIMEOUT_MS = 60_000;
export const MAX_RETRIES = 2;

export function parseJsonSafely(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function httpGetJson<T = unknown>(urlString: string, userAgent: string): Promise<T> {
  const url = new URL(urlString);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise<T>((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': userAgent,
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          const parsed = parseJsonSafely(responseBody);
          const status = res.statusCode ?? 500;

          if (status < 200 || status >= 300) {
            reject(new HttpError(`Request failed with status ${status}`, status, parsed));
            return;
          }

          resolve(parsed as T);
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new CliError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, EXIT_CODES.NETWORK_ERROR));
    });

    req.on('error', (error) => {
      reject(
        error instanceof CliError
          ? error
          : new CliError(`Network request failed: ${getErrorMessage(error)}`, EXIT_CODES.NETWORK_ERROR),
      );
    });

    req.end();
  });
}

export async function downloadToFile(urlString: string, destination: string, userAgent: string): Promise<void> {
  const url = new URL(urlString);
  const transport = url.protocol === 'https:' ? https : http;

  await fs.ensureDir(path.dirname(destination));

  return new Promise<void>((resolve, reject) => {
    const fileStream = fs.createWriteStream(destination, { mode: 0o755 });

    const req = transport.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: {
          'User-Agent': userAgent,
        },
      },
      (res) => {
        if ((res.statusCode ?? 500) >= 300 && (res.statusCode ?? 500) < 400 && res.headers.location) {
          fileStream.close();
          fs.remove(destination).catch(() => undefined).finally(() => {
            downloadToFile(res.headers.location as string, destination, userAgent).then(resolve).catch(reject);
          });
          return;
        }

        if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
          fileStream.close();
          fs.remove(destination).catch(() => undefined).finally(() => {
            reject(new CliError(`Download failed with status ${res.statusCode ?? 500}`, EXIT_CODES.NETWORK_ERROR));
          });
          return;
        }

        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new CliError(`Download timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, EXIT_CODES.NETWORK_ERROR));
    });

    req.on('error', (error) => {
      fileStream.close();
      fs.remove(destination).catch(() => undefined).finally(() => {
        reject(
          error instanceof CliError
            ? error
            : new CliError(`Download failed: ${getErrorMessage(error)}`, EXIT_CODES.NETWORK_ERROR),
        );
      });
    });
  });
}

export async function httpPost(baseUrl: string, token: string, endpoint: string, body: object): Promise<{ status: number; data: unknown }> {
  const url = new URL(endpoint, baseUrl);
  const transport = url.protocol === 'https:' ? https : http;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = transport.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: `${url.pathname}${url.search}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data),
              Authorization: `Bearer ${token}`,
            },
          },
          (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              responseBody += chunk;
            });
            res.on('end', () => {
              const parsed = parseJsonSafely(responseBody);
              const status = res.statusCode ?? 500;

              if (status < 200 || status >= 300) {
                reject(new HttpError(`Request failed with status ${status}`, status, parsed, status === 401 || status === 403 ? EXIT_CODES.AUTH_ERROR : EXIT_CODES.API_ERROR));
                return;
              }

              resolve({ status, data: parsed });
            });
          },
        );

        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
          req.destroy(new CliError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, EXIT_CODES.NETWORK_ERROR));
        });

        req.on('error', (error) => {
          reject(
            error instanceof CliError
              ? error
              : new CliError(`Network request failed: ${getErrorMessage(error)}`, EXIT_CODES.NETWORK_ERROR),
          );
        });

        req.write(data);
        req.end();
      });
    } catch (error) {
      const shouldRetry = attempt < MAX_RETRIES && error instanceof CliError && error.exitCode === EXIT_CODES.NETWORK_ERROR;
      if (!shouldRetry) throw error;
    }
  }

  throw new CliError('Request failed after retries.', EXIT_CODES.NETWORK_ERROR);
}
