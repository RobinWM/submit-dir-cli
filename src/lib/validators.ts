import { CliError, EXIT_CODES } from './errors';

export function validateUrl(input: string): string {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new CliError(`Invalid URL: ${input}`, EXIT_CODES.GENERAL_ERROR);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new CliError(`Unsupported URL protocol: ${parsed.protocol}`, EXIT_CODES.GENERAL_ERROR);
  }

  return parsed.toString();
}
