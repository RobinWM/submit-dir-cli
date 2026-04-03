#!/bin/bash
set -euo pipefail

REPO_OWNER="RobinWM"
REPO_NAME="ship-cli"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
RELEASE_BASE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download"
INSTALL_DIR="$HOME/.ship/bin"
TARGET_BIN="$INSTALL_DIR/ship"
TEMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t ship)"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

log() {
  printf '%s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

ensure_in_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) return 0 ;;
  esac

  local shell_name shell_rc
  shell_name="$(basename "${SHELL:-bash}")"

  case "$shell_name" in
    zsh) shell_rc="$HOME/.zshrc" ;;
    bash) shell_rc="$HOME/.bashrc" ;;
    *) shell_rc="$HOME/.profile" ;;
  esac

  mkdir -p "$(dirname "$shell_rc")"
  touch "$shell_rc"

  if ! grep -Fq 'export PATH="$HOME/.ship/bin:$PATH"' "$shell_rc"; then
    {
      echo
      echo '# ship'
      echo 'export PATH="$HOME/.ship/bin:$PATH"'
    } >> "$shell_rc"
  fi

  log "⚠️  Added $INSTALL_DIR to PATH in $shell_rc"
  log "   Run: source $shell_rc"
}

resolve_os() {
  local uname_s
  uname_s="$(uname -s)"

  case "$uname_s" in
    Linux) echo "linux" ;;
    Darwin) echo "darwin" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) log "Unsupported operating system: $uname_s"; exit 1 ;;
  esac
}

resolve_arch() {
  local uname_m
  uname_m="$(uname -m)"

  case "$uname_m" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) log "Unsupported architecture: $uname_m"; exit 1 ;;
  esac
}

download_file() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output"
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$output"
    return 0
  fi

  log "Missing required command: curl or wget"
  exit 1
}

try_download_file() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output" >/dev/null 2>&1
    return $?
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$output" >/dev/null 2>&1
    return $?
  fi

  return 1
}

verify_binary() {
  local binary_path="$1"
  if ! "$binary_path" --help >/dev/null 2>&1; then
    log "Downloaded binary failed verification: $binary_path"
    exit 1
  fi
}

install_release_binary() {
  local os="$1"
  local arch="$2"
  local asset_name="ship-${os}-${arch}"
  if [ "$os" = "windows" ]; then
    asset_name="ship-windows-${arch}.exe"
  fi
  local temp_binary="$TEMP_DIR/$asset_name"
  local release_url="${RELEASE_BASE_URL}/${asset_name}"

  if ! try_download_file "$release_url" "$temp_binary"; then
    return 1
  fi

  chmod +x "$temp_binary" 2>/dev/null || true
  verify_binary "$temp_binary"

  if [ "$os" = "windows" ]; then
    cp "$temp_binary" "$TARGET_BIN.exe"
    cat > "$TARGET_BIN" <<'EOF'
#!/bin/sh
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec "$DIR/ship.exe" "$@"
EOF
    chmod +x "$TARGET_BIN"
    log "✅ Installed release binary to $TARGET_BIN.exe"
    return 0
  fi

  mv "$temp_binary" "$TARGET_BIN"
  chmod +x "$TARGET_BIN"
  log "✅ Installed release binary to $TARGET_BIN"
  return 0
}

find_npm_global_bin() {
  local prefix
  prefix="$(npm prefix -g)"

  if [ -d "$prefix/bin" ]; then
    printf '%s\n' "$prefix/bin"
    return 0
  fi

  if [ -d "$prefix" ]; then
    printf '%s\n' "$prefix"
    return 0
  fi

  return 1
}

install_from_npm_package() {
  require_command npm

  if [ "${1:-}" = "windows" ]; then
    log "No Windows executable asset found in the latest release. Refusing broken JS fallback."
    log "Please install with: npm install -g https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/ship-latest.tgz"
    exit 1
  fi

  local package_url="${RELEASE_BASE_URL}/ship-latest.tgz"
  local package_tgz="$TEMP_DIR/ship.tgz"

  if ! try_download_file "$package_url" "$package_tgz"; then
    return 1
  fi

  log "Installing published package..."
  local package_dir="$INSTALL_DIR/package"
  rm -rf "$package_dir"
  mkdir -p "$package_dir"
  tar -xzf "$package_tgz" -C "$package_dir"

  if [ ! -f "$package_dir/package/dist/index.js" ]; then
    log "Published package is missing dist/index.js"
    exit 1
  fi

  cp "$package_dir/package/dist/index.js" "$TARGET_BIN"
  chmod +x "$TARGET_BIN"
  log "✅ Installed package payload to $TARGET_BIN"
  return 0
}

install_from_source() {
  require_command git
  require_command npm

  log "No published artifact found. Falling back to source install..."
  git clone --depth=1 "$REPO_URL" "$TEMP_DIR/repo"
  cd "$TEMP_DIR/repo"
  npm install
  npm run build

  cp dist/index.js "$TARGET_BIN"
  chmod +x "$TARGET_BIN"
  log "✅ Installed source-built CLI to $TARGET_BIN"
}

main() {
  log "Installing ship..."

  mkdir -p "$INSTALL_DIR"

  local os arch
  os="$(resolve_os)"
  arch="$(resolve_arch)"

  if install_release_binary "$os" "$arch"; then
    ensure_in_path
    log "✅ Done! Run 'ship --help' to get started."
    return 0
  fi

  if install_from_npm_package "$os"; then
    ensure_in_path
    log "✅ Done! Run 'ship --help' to get started."
    return 0
  fi

  if [ "$os" = "windows" ]; then
    log "Windows source fallback is disabled because it produces a broken JS-only install."
    exit 1
  fi

  install_from_source
  ensure_in_path
  log "✅ Done! Run 'ship --help' to get started."
}

main "$@"
