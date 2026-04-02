#!/bin/bash
set -euo pipefail

REPO_URL="https://github.com/RobinWM/submit-dir-cli.git"
TEMP_DIR="$(mktemp -d)"
INSTALL_DIR="$HOME/.submit-dir/bin"
TARGET_BIN="$INSTALL_DIR/submit-dir"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

log() {
  printf '%s\n' "$1"
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

  if ! grep -Fq 'export PATH="$HOME/.submit-dir/bin:$PATH"' "$shell_rc"; then
    {
      echo
      echo '# submit-dir'
      echo 'export PATH="$HOME/.submit-dir/bin:$PATH"'
    } >> "$shell_rc"
  fi

  log "⚠️  Added $INSTALL_DIR to PATH in $shell_rc"
  log "   Run: source $shell_rc"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

log "Installing submit-dir..."

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) log "Unsupported architecture: $ARCH"; exit 1 ;;
esac

mkdir -p "$INSTALL_DIR"

RELEASE_URL="https://github.com/RobinWM/submit-dir-cli/releases/latest/download/submit-dir-${OS}-${ARCH}"
INSTALLED=0

if command -v curl >/dev/null 2>&1; then
  if curl -fsI "$RELEASE_URL" >/dev/null 2>&1; then
    log "Downloading binary for $OS/$ARCH..."
    curl -fsSL "$RELEASE_URL" -o "$TARGET_BIN"
    chmod +x "$TARGET_BIN"
    INSTALLED=1
    log "✅ Installed binary to $TARGET_BIN"
  fi
elif command -v wget >/dev/null 2>&1; then
  if wget -q --spider "$RELEASE_URL" 2>/dev/null; then
    log "Downloading binary for $OS/$ARCH..."
    wget -q "$RELEASE_URL" -O "$TARGET_BIN"
    chmod +x "$TARGET_BIN"
    INSTALLED=1
    log "✅ Installed binary to $TARGET_BIN"
  fi
fi

if [ "$INSTALLED" = "0" ]; then
  log "No prebuilt binary found. Falling back to npm install..."
  require_command git
  require_command npm

  git clone --depth=1 "$REPO_URL" "$TEMP_DIR/repo"
  cd "$TEMP_DIR/repo"
  npm install
  npm run build
  npm pack >/dev/null

  PACKAGE_TGZ="$(ls submit-dir-*.tgz | head -n 1)"
  npm install -g "$PACKAGE_TGZ"

  GLOBAL_BIN_DIR="$(npm bin -g)"
  if [ ! -x "$GLOBAL_BIN_DIR/submit-dir" ]; then
    log "submit-dir binary not found after npm install"
    exit 1
  fi

  ln -sf "$GLOBAL_BIN_DIR/submit-dir" "$TARGET_BIN"
  log "✅ Installed npm package to $TARGET_BIN"
fi

ensure_in_path
log "✅ Done! Run 'submit-dir --help' to get started."
