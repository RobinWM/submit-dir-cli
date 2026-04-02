# submit-dir

CLI tool for submitting URLs to [aidirs.org](https://aidirs.org) and [backlinkdirs.com](https://backlinkdirs.com).

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/RobinWM/submit-dir-cli/main/install.sh | bash
```

> **Windows?** Use [Git Bash](https://git-scm.com/download/win) or [WSL](https://docs.microsoft.com/en-us/windows/wsl/). On PowerShell, use `curl.exe` explicitly.

Or from source:

```bash
git clone https://github.com/RobinWM/submit-dir-cli.git
cd submit-dir
bash install.sh
```

## Setup

> **Note:** Submitting URLs requires an active subscription plan.

```bash
submit-dir login
```

Or choose a site explicitly:

```bash
submit-dir login --site aidirs.org
submit-dir login --site backlinkdirs.com
```

Select the site, browser opens automatically, login and done. Tokens are auto-saved per site. If you don't have an API token yet, one will be created automatically.

## Usage

### Login
```bash
submit-dir login
submit-dir login --site backlinkdirs.com
```

### Submit a URL
```bash
submit-dir submit https://example.com
submit-dir submit https://example.com --site backlinkdirs.com
```

### Preview a URL (no record created)
```bash
submit-dir fetch https://example.com
submit-dir fetch https://example.com --site aidirs.org
```

### Show help
```bash
submit-dir --help
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Browser-based login (supports aidirs.org & backlinkdirs.com) |
| `submit <url>` | Submit a URL to the selected site |
| `fetch <url>` | Preview a URL without creating a record |
| `--help` | Show help |

## Config Location

`~/.config/submit-dir/config.json`

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

Config file takes priority. Environment variables serve as fallback for the active or overridden site:

```bash
export DIRS_TOKEN="your-token-here"
export DIRS_BASE_URL="https://aidirs.org"
submit-dir submit https://example.com
```
