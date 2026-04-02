# submit-dir

一键提交 URL 到 [aidirs.org](https://aidirs.org) 和 [backlinkdirs.com](https://backlinkdirs.com) 的命令行工具。

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/RobinWM/submit-dir-cli/main/install.sh | bash
```

> **Windows 用户？** 请使用 [Git Bash](https://git-scm.com/download/win) 或 [WSL](https://docs.microsoft.com/en-us/windows/wsl/)。PowerShell 可尝试 `curl.exe`。

或从源码安装：

```bash
git clone https://github.com/RobinWM/submit-dir-cli.git
cd submit-dir-cli
bash install.sh
```

## 登录

> **注意：** 提交 URL 需要订阅计划。

```bash
submit-dir login
```

也可以显式指定站点：

```bash
submit-dir login --site aidirs.org
submit-dir login --site backlinkdirs.com
```

选择站点 → 自动打开浏览器 → 在浏览器里完成登录 → Token 会按站点自动保存。
如果还没有 API Token，系统会自动创建一个。

## 使用

### 提交 URL
```bash
submit-dir submit https://example.com
submit-dir submit https://example.com --site backlinkdirs.com
submit-dir submit https://example.com --json
submit-dir submit https://example.com --quiet
```

### 预览（不产生记录）
```bash
submit-dir fetch https://example.com
submit-dir fetch https://example.com --site aidirs.org
submit-dir fetch https://example.com --json
```

### 查看帮助
```bash
submit-dir --help
```

## 命令

| 命令 | 说明 |
|------|------|
| `login` | 浏览器授权登录（支持 aidirs.org 和 backlinkdirs.com） |
| `submit <url>` | 提交 URL 到当前选中的站点 |
| `fetch <url>` | 预览网站元数据，不产生提交记录 |
| `--json` | 输出机器可读 JSON |
| `--quiet` | 只输出响应内容 |
| `--help` | 显示帮助 |

## 配置文件

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

旧版单站点配置会在下次使用/登录时自动兼容读取。

## 环境变量

配置文件优先，环境变量作为当前站点或 `--site` 覆盖站点的备用：

```bash
export DIRS_TOKEN="your-token-here"
export DIRS_BASE_URL="https://aidirs.org"
submit-dir submit https://example.com
```

## 开发

```bash
npm install
npm run build
npm test
```

发布时通过 `package.json` 的 `files` 字段控制内容，npm 包会包含 `dist/` 构建产物。
