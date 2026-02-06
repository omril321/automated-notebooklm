#!/bin/bash
#
# Setup script for notebooklm-py CLI integration
# Creates a local Python virtual environment and installs notebooklm-py
# Requires Python 3.10+ (notebooklm-py uses modern type syntax)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

echo "🐍 Setting up notebooklm-py in $VENV_DIR..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ Error: 'uv' is not installed."
    echo ""
    echo "Install uv with:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo ""
    echo "Or via Homebrew:"
    echo "  brew install uv"
    exit 1
fi

# Find Python 3.10+ interpreter
# Priority: pyenv 3.10+, then system python3
find_python() {
    # Check pyenv versions first
    if command -v pyenv &> /dev/null; then
        for version in $(pyenv versions --bare 2>/dev/null | grep -E '^3\.(1[0-9]|[2-9][0-9])' | sort -rV); do
            local py_path="$HOME/.pyenv/versions/$version/bin/python"
            if [ -x "$py_path" ]; then
                echo "$py_path"
                return 0
            fi
        done
    fi

    # Check system python3
    if command -v python3 &> /dev/null; then
        local py_version=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        local major=$(echo "$py_version" | cut -d. -f1)
        local minor=$(echo "$py_version" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
            echo "$(command -v python3)"
            return 0
        fi
    fi

    return 1
}

PYTHON_BIN=$(find_python)
if [ -z "$PYTHON_BIN" ]; then
    echo "❌ Error: Python 3.10+ is required but not found."
    echo ""
    echo "Install Python 3.10+ via pyenv:"
    echo "  pyenv install 3.10.13"
    echo "  pyenv global 3.10.13"
    echo ""
    echo "Or via Homebrew:"
    echo "  brew install python@3.10"
    exit 1
fi

echo "📍 Using Python: $PYTHON_BIN"

# Create virtual environment (recreate if exists to ensure correct Python version)
if [ -d "$VENV_DIR" ]; then
    echo "🔄 Recreating virtual environment with Python 3.10+..."
    rm -rf "$VENV_DIR"
fi
echo "📦 Creating virtual environment..."
uv venv "$VENV_DIR" --python "$PYTHON_BIN"

# Install notebooklm-py with browser support
echo "📥 Installing notebooklm-py with browser support..."
uv pip install "notebooklm-py[browser]" --python "$VENV_DIR/bin/python"

# Install Playwright browsers for authentication
echo "🌐 Installing Playwright browsers..."
"$VENV_DIR/bin/playwright" install chromium

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run './scripts/nlm login' to authenticate with Google"
echo "  2. Run './scripts/nlm list' to verify the setup"
echo ""
