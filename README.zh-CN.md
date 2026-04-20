# ship

一键提交 URL 到 [aidirs.org](https://aidirs.org)、[clidirs.com](https://clidirs.com) 和 [backlinkdirs.com](https://backlinkdirs.com) 的命令行工具。

## 安装

**优选：** 通过 npm 安装，最快也最方便后续升级。

### npm 安装

```bash
npm install -g @brenn/ship
```

安装后运行：

```bash
ship --help
```

### 备选：macOS / Linux / WSL 安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/RobinWM/ship-cli/main/install.sh | bash
```

### 备选：Windows PowerShell 安装脚本

```powershell
irm https://raw.githubusercontent.com/RobinWM/ship-cli/main/install.ps1 | iex
```

### 备选：Windows CMD 安装脚本

```cmd
curl -fsSL https://raw.githubusercontent.com/RobinWM/ship-cli/main/install.cmd -o install.cmd && install.cmd && del install.cmd
```

或从源码安装：

```bash
git clone https://github.com/RobinWM/ship-cli.git
cd ship-cli
bash install.sh
```

## 登录

> **注意：** 提交 URL 需要订阅计划。

```bash
ship login
```

也可以显式指定站点：

```bash
ship login --site aidirs.org
ship login --site backlinkdirs.com
```

选择站点 → 自动打开浏览器 → 在浏览器里完成登录 → Token 会按站点自动保存。
如果还没有 API Token，系统会自动创建一个。

## 使用

### 提交 URL
```bash
ship submit https://example.com
ship submit https://example.com --site backlinkdirs.com
ship submit https://example.com --json
ship submit https://example.com --quiet
```

### 预览（不产生记录）
```bash
ship fetch https://example.com
ship fetch https://example.com --site aidirs.org
ship fetch https://example.com --json
```

### 查看帮助
```bash
ship --help
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

旧版单站点配置会在下次使用/登录时自动兼容读取。

## 环境变量

多站点场景下，**推荐使用配置文件**。

环境变量仍然可用，但更适合作为**当前命令的单站点覆盖/兜底方案**：

```bash
export DIRS_TOKEN="your-token-here"
export DIRS_BASE_URL="https://aidirs.org"
ship submit https://example.com
```

使用环境变量时，`DIRS_TOKEN` 会应用到 `DIRS_BASE_URL` 指向的站点（如果未提供 `DIRS_BASE_URL`，则落到默认站点）。如果需要长期管理多个站点，建议使用 `ship login`，把 token 按站点写入配置文件。

## 开发

```bash
npm install
npm run build
npm test
```

## 发布版本

现在的发布流程已经收敛成“一个本地命令 + 一个 GitHub Actions 工作流”：

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

每个发布命令都会做这四件事：

1. 运行 `npm test`
2. 通过 `npm version` 升级版本号
3. 创建对应的 git tag，例如 `v0.1.10`
4. 推送 `main` 分支和新 tag 到 GitHub

tag 推送后，[`.github/workflows/release.yml`](./.github/workflows/release.yml) 会自动：

- 如果 GitHub Release 还不存在，就先创建 Release
- 构建 Linux、macOS、Windows 的独立可执行文件
- 构建 npm 包的 tarball
- 把这些发布资产上传到对应的 GitHub Release
- 如果 GitHub Actions secrets 里配置了 `NPM_TOKEN`，还会自动发布到 npm

如果只是想重新构建或重新上传某个已有版本的发布资产，也可以在 GitHub Actions 页面手动运行 `Release` 工作流，并输入一个已存在的 tag。

## 发布到 npm

现在可以通过 GitHub Actions 自动发布到 npm。

**必须先配置 `NPM_TOKEN`，否则 workflow 只会创建 GitHub Release 并上传资产，不会发布到 npm。**

在仓库中按下面路径添加 secret：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

然后填写：

```text
Name: NPM_TOKEN
Value: 你的 npm automation token
```

建议使用 npm 的 automation token，这样在 CI/CD 场景下不会被交互式登录或 2FA 阻塞。

如果你仍然希望手动发布到 npm，也可以执行：

```bash
npm login
npm pack --dry-run
npm publish
```

发布时通过 `package.json` 的 `files` 字段控制内容，所以 npm 包会包含 `dist/` 构建产物。

GitHub Release 预期会发布这些资产：
- `ship-linux-x64`
- `ship-linux-arm64`
- `ship-darwin-x64`
- `ship-darwin-arm64`
- `ship-windows-x64.exe`
- `ship-latest.tgz`
