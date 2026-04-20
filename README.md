# ship

CLI tool for submitting URLs to [aidirs.org](https://aidirs.org)、[clidirs.com](https://clidirs.com) and [backlinkdirs.com](https://backlinkdirs.com).

## Installation

**Recommended:** install from npm for the fastest setup and easiest updates.

### npm

```bash
npm install -g @brenn/ship
```

Then run:

```bash
ship --help
```

### Alternative: macOS / Linux / WSL installer

```bash
curl -fsSL https://raw.githubusercontent.com/RobinWM/ship-cli/main/install.sh | bash
```

### Alternative: Windows PowerShell installer

```powershell
irm https://raw.githubusercontent.com/RobinWM/ship-cli/main/install.ps1 | iex
```

### Alternative: Windows CMD installer

```cmd
curl -fsSL https://raw.githubusercontent.com/RobinWM/ship-cli/main/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Or from source:

```bash
git clone https://github.com/RobinWM/ship-cli.git
cd ship-cli
bash install.sh
```

## Setup

> **Note:** Submitting URLs requires an active subscription plan.

```bash
ship login
```

Or choose a site explicitly:

```bash
ship login --site aidirs.org
ship login --site backlinkdirs.com
```

Select the site, browser opens automatically, login and done. Tokens are auto-saved per site. If you don't have an API token yet, one will be created automatically.

## Usage

### Login
```bash
ship login
ship login --site backlinkdirs.com
```

### Submit a URL
```bash
ship submit https://example.com
ship submit https://example.com --site backlinkdirs.com
ship submit https://example.com --json
ship submit https://example.com --quiet
```

### Preview a URL (no record created)
```bash
ship fetch https://example.com
ship fetch https://example.com --site aidirs.org
ship fetch https://example.com --json
```

### Show help
```bash
ship --help
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Browser-based login (supports aidirs.org & backlinkdirs.com) |
| `submit <url>` | Submit a URL to the selected site |
| `fetch <url>` | Preview a URL without creating a record |
| `--json` | Machine-readable output for scripts |
| `--quiet` | Print only response payload |
| `--help` | Show help |

## Config Location

`~/.config/ship/config.json`

```json
{
  "currentSite": "aidirs.org",
  "sites": {
    "aidirs.org": {
      "token": "your-token-here",
      "baseUrl": "https://aidirs.org"
    },
    "backlinkdirs.com": {
      "token": "your-other-token",
      "baseUrl": "https://backlinkdirs.com"
    }
  }
}
```

Legacy single-site config is migrated automatically on next login/use.

## Environment Variables

Config file is the recommended approach for multi-site usage.

Environment variables are still supported, but they work best as a single-site override/fallback for the current command:

```bash
export DIRS_TOKEN="your-token-here"
export DIRS_BASE_URL="https://aidirs.org"
ship submit https://example.com
```

When using environment variables, `DIRS_TOKEN` is applied to the site identified by `DIRS_BASE_URL` (or the default site if `DIRS_BASE_URL` is omitted). For managing multiple sites long-term, use `ship login` so tokens are stored per site in the config file.

## Development

```bash
npm install
npm run build
npm test
```

## Release

The release flow is now a single local command plus one GitHub Actions workflow:

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

Each release command does four things:

1. Runs `npm test`
2. Bumps the version with `npm version`
3. Creates the matching git tag like `v0.1.10`
4. Pushes `main` and the new tag to GitHub

After the tag is pushed, [`.github/workflows/release.yml`](./.github/workflows/release.yml) automatically:

- creates the GitHub Release if it does not exist yet
- builds standalone binaries for Linux, macOS, and Windows
- builds the npm package tarball
- uploads all release assets to that GitHub Release
- publishes the package to npm when `NPM_TOKEN` is configured in GitHub Actions secrets

You can manually rerun the asset build from the GitHub Actions UI by running the `Release` workflow and entering an existing tag.

## Publish to npm

The release workflow can also publish to npm automatically.

**You must configure `NPM_TOKEN` first. Otherwise the workflow will create the GitHub Release and upload assets, but it will skip `npm publish`.**

Add this secret in your repository:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Then set:

```text
Name: NPM_TOKEN
Value: your npm automation token
```

An npm automation token is recommended so CI publishing is not blocked by interactive login or 2FA prompts.

If you prefer to publish manually, run:

```bash
npm login
npm pack --dry-run
npm publish
```

Publishing uses `files` in `package.json`, so npm packages include `dist/` even though build output is generated from `src/`.

GitHub Releases are expected to publish:
- `ship-linux-x64`
- `ship-linux-arm64`
- `ship-darwin-x64`
- `ship-darwin-arm64`
- `ship-windows-x64.exe`
- `ship-latest.tgz`
