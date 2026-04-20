import { loadConfig } from './config'
import { HttpResponse, printCommandError, printResult } from './output'
import { httpPost } from './http'
import { maybeNotifyUpdate } from './update'
import { validateUrl } from './validators'

export async function submit(
  cliVersion: string,
  targetUrl: string,
  options: { site?: string; json?: boolean; quiet?: boolean },
) {
  try {
    await maybeNotifyUpdate(cliVersion, { json: options.json, quiet: options.quiet })
    const validUrl = validateUrl(targetUrl)
    const config = await loadConfig({ site: options.site })

    if (!options.json && !options.quiet) {
      console.log(`Submitting ${validUrl} to ${config.baseUrl}...`)
    }

    const result: HttpResponse = await httpPost(config.baseUrl, config.token, '/api/submit', {
      link: validUrl,
      source: 'cli',
    })
    printResult(result, options, config.baseUrl)
  } catch (error: unknown) {
    printCommandError(error, options)
  }
}

export async function fetchPreview(
  cliVersion: string,
  targetUrl: string,
  options: { site?: string; json?: boolean; quiet?: boolean },
) {
  try {
    await maybeNotifyUpdate(cliVersion, { json: options.json, quiet: options.quiet })
    const validUrl = validateUrl(targetUrl)
    const config = await loadConfig({ site: options.site })

    if (!options.json && !options.quiet) {
      console.log(`Fetching preview for ${validUrl} from ${config.baseUrl}...`)
    }

    const result: HttpResponse = await httpPost(config.baseUrl, config.token, '/api/fetch-website', { link: validUrl })
    printResult(result, options, config.baseUrl)
  } catch (error: unknown) {
    printCommandError(error, options)
  }
}
