#!/bin/bash
#
# Read to Me - Installation Script
#
# This script:
# 1. Finds a suitable Python (3.10+)
# 2. Sets up the Python venv with Piper TTS
# 3. Downloads voice model if needed
# 4. Rewrites the native host shebang to use venv Python
# 5. Registers native messaging host with Chrome
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.claudebot.audio_briefer"
HOST_SCRIPT="$SCRIPT_DIR/native-host/audio_briefer_host.py"
VENV_DIR="$SCRIPT_DIR/native-host/.venv"

echo "🎧 Read to Me - Installation"
echo "========================================"
echo ""

# Function to check if a Python is suitable (3.10+)
check_python_version() {
    local python_path="$1"
    if [ ! -x "$python_path" ]; then
        return 1
    fi
    
    local version=$("$python_path" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
    if [ -z "$version" ]; then
        return 1
    fi
    
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    
    if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
        echo "$version"
        return 0
    fi
    return 1
}

# Find a suitable Python installation
echo "Looking for Python 3.10+..."

PYTHON_CMD=""
PYTHON_VERSION=""

# Check common locations in order of preference
PYTHON_CANDIDATES=(
    "/opt/homebrew/bin/python3.12"
    "/opt/homebrew/bin/python3.11"
    "/opt/homebrew/bin/python3.10"
    "/opt/homebrew/bin/python3"
    "/usr/local/bin/python3.12"
    "/usr/local/bin/python3.11"
    "/usr/local/bin/python3.10"
    "/usr/local/bin/python3"
    "python3.12"
    "python3.11"
    "python3.10"
    "python3"
)

for candidate in "${PYTHON_CANDIDATES[@]}"; do
    # Resolve command to full path if needed
    if [[ "$candidate" != /* ]]; then
        candidate=$(command -v "$candidate" 2>/dev/null || echo "")
        if [ -z "$candidate" ]; then
            continue
        fi
    fi
    
    # check_python_version returns 1 if not suitable, so disable set -e temporarily
    version=$(check_python_version "$candidate" || true)
    if [ -n "$version" ]; then
        PYTHON_CMD="$candidate"
        PYTHON_VERSION="$version"
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ No Python 3.10+ found!"
    echo ""
    echo "macOS ships with Python 3.9 which doesn't support piper-tts."
    echo ""
    echo "Install Python 3.12 with Homebrew:"
    echo "  brew install python@3.12"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✓ Found Python $PYTHON_VERSION at $PYTHON_CMD"

# Step 1: Set up Python venv
echo ""
if [ -d "$VENV_DIR" ]; then
    # Check if existing venv has right Python version
    VENV_PYTHON="$VENV_DIR/bin/python"
    if [ -x "$VENV_PYTHON" ]; then
        VENV_VERSION=$("$VENV_PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "")
        if [ "$VENV_VERSION" = "$PYTHON_VERSION" ]; then
            echo "✓ Python venv already exists (Python $VENV_VERSION)"
        else
            echo "Recreating venv (was Python $VENV_VERSION, need $PYTHON_VERSION)..."
            rm -rf "$VENV_DIR"
        fi
    else
        echo "Recreating venv (broken installation)..."
        rm -rf "$VENV_DIR"
    fi
fi

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
    
    echo "Installing dependencies..."
    "$VENV_DIR/bin/pip" install --quiet --upgrade pip
    "$VENV_DIR/bin/pip" install --quiet piper-tts pathvalidate
    echo "✓ Installed Piper TTS"
fi

# Step 2: Check/download Piper voice model
PIPER_MODEL="$HOME/.local/share/piper/en_US-lessac-medium.onnx"
if [ ! -f "$PIPER_MODEL" ]; then
    echo ""
    echo "Downloading Piper voice model (~100MB)..."
    mkdir -p "$HOME/.local/share/piper"
    curl -L --progress-bar \
        'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx' \
        -o "$PIPER_MODEL"
    curl -sL \
        'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json' \
        -o "$HOME/.local/share/piper/en_US-lessac-medium.onnx.json"
    echo "✓ Downloaded voice model"
else
    echo "✓ Piper voice model found"
fi

# Step 3: Rewrite shebang in native host to use venv Python directly
# Chrome on macOS can't launch bash wrapper scripts as native messaging hosts
echo ""
echo "Configuring native host..."
VENV_PYTHON_PATH="$VENV_DIR/bin/python"

# Create a backup and rewrite the shebang
if [ -f "$HOST_SCRIPT" ]; then
    # Read the file, replace shebang, write back
    SHEBANG_LINE="#!$VENV_PYTHON_PATH"
    
    # Use sed to replace the first line (shebang)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed requires empty string for -i
        sed -i '' "1s|^#!.*|$SHEBANG_LINE|" "$HOST_SCRIPT"
    else
        sed -i "1s|^#!.*|$SHEBANG_LINE|" "$HOST_SCRIPT"
    fi
    
    chmod +x "$HOST_SCRIPT"
    echo "✓ Configured native host shebang"
else
    echo "❌ Native host script not found at $HOST_SCRIPT"
    exit 1
fi

# Step 4: Get Chrome extension ID
echo ""
echo "📋 You need your Chrome extension ID"
echo ""
echo "1. Open Chrome → chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked' and select:"
echo "   $SCRIPT_DIR/extension"
echo "4. Copy the 'ID' shown under the extension"
echo ""
read -p "Enter your extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo "❌ Extension ID is required"
    exit 1
fi

# Step 5: Create native messaging manifest
# Points directly to .py file (not a wrapper)
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Read to Me - Convert articles to audio",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
echo "✓ Registered native messaging host"

# Step 6: Create output directory
mkdir -p "$HOME/Downloads/audio-briefings"
echo "✓ Created output directory"

echo ""
echo "========================================"
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Reload the extension in chrome://extensions/"
echo "2. Visit any article"
echo "3. Click the extension icon and hit Play"
echo ""
echo "Troubleshooting:"
echo "  ~/Downloads/audio-briefings/error.log"
echo ""
