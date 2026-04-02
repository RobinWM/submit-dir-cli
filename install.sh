#!/bin/bash
set -e

REPO_URL="https://github.com/RobinWM/submit-dir-cli.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.submit-dir/bin}"
TEMP_DIR="$(mktemp -d)"
SHELL_RC="$HOME/.bashrc"

echo "Installing submit-dir..."

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

RELEASE_URL="https://github.com/RobinWM/submit-dir-cli/releases/latest/download/submit-dir-${OS}-${ARCH}"
INSTALLED=0

# Try pre-built binary
if command -v curl &>/dev/null; then
  if curl -sfL "$RELEASE_URL" --head &>/dev/null; then
    echo "Downloading binary for $OS/$ARCH..."
    mkdir -p "$INSTALL_DIR"
    curl -sfL "$RELEASE_URL" -o "$INSTALL_DIR/submit-dir"
    chmod +x "$INSTALL_DIR/submit-dir"
    INSTALLED=1
  fi
elif command -v wget &>/dev/null; then
  if wget -q --spider "$RELEASE_URL" 2>/dev/null; then
    echo "Downloading binary for $OS/$ARCH..."
    mkdir -p "$INSTALL_DIR"
    wget -q "$RELEASE_URL" -O "$INSTALL_DIR/submit-dir"
    chmod +x "$INSTALL_DIR/submit-dir"
    INSTALLED=1
  fi
fi

# Fall back to cloning repo
if [ "$INSTALLED" = "0" ]; then
  echo "No pre-built binary for $OS/$ARCH. Cloning repository..."
  if ! command -v git &>/dev/null; then
    echo "Error: git is required to install from source"
    exit 1
  fi
  git clone --depth=1 "$REPO_URL" "$TEMP_DIR/repo"
  mkdir -p "$INSTALL_DIR"
  cp "$TEMP_DIR/repo/dist/index.js" "$INSTALL_DIR/submit-dir"
  chmod +x "$INSTALL_DIR/submit-dir"
  rm -rf "$TEMP_DIR"
  echo "✅ Installed to $INSTALL_DIR/submit-dir"
fi

# Add to PATH
if [ -f "$SHELL_RC" ] && ! grep -q "\.submit-dir/bin" "$SHELL_RC"; then
  echo "" >> "$SHELL_RC"
  echo "# submit-dir" >> "$SHELL_RC"
  echo 'export PATH="$HOME/.submit-dir/bin:$PATH"' >> "$SHELL_RC"
  echo "Added \$HOME/.submit-dir/bin to PATH in $SHELL_RC"
fi

echo "✅ Done! Run 'submit-dir --help' to get started."
