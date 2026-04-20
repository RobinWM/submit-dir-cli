#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const bumpType = process.argv[2]
const allowedBumpTypes = new Set(['patch', 'minor', 'major'])

function resolveCommand(command) {
  if (process.platform !== 'win32') return command
  return command === 'npm' ? 'npm.cmd' : command
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(resolveCommand(command), args, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })

  if (result.error) {
    fail(`${command} failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    process.exit(result.status ?? 1)
  }

  return options.capture ? result.stdout.trim() : ''
}

function requireCommand(command) {
  const result = spawnSync(resolveCommand(command), ['--version'], {
    stdio: 'ignore',
  })

  if (result.error || result.status !== 0) {
    fail(`${command} is required`)
  }
}

if (!allowedBumpTypes.has(bumpType)) {
  fail('Usage: npm run release:<patch|minor|major>')
}

requireCommand('git')
requireCommand('npm')

const currentBranch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true })
if (currentBranch !== 'main') {
  fail(`Release must be run from main. Current branch: ${currentBranch}`)
}

const workingTreeStatus = run('git', ['status', '--porcelain'], { capture: true })
if (workingTreeStatus) {
  fail('Working tree is dirty. Commit or stash changes first.')
}

run('npm', ['test'])

const tagName = run('npm', ['version', bumpType, '-m', 'chore: release v%s'], { capture: true })
  .split(/\r?\n/)
  .at(-1)

run('git', ['push', 'origin', 'main', '--follow-tags'])

console.log(`Released ${tagName}. GitHub Actions will create the GitHub Release and upload assets.`)
