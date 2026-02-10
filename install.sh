#!/bin/bash
#
# Read to Me - Installation Script
#
# This script:
# 1. Validates Python version (3.10+ required)
# 2. Sets up the Python venv with Piper TTS
# 3. Downloads voice model if needed
# 4. Registers native messaging host with Chrome
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.claudebot.audio_briefer"
HOST_SCRIPT="$SCRIPT_DIR/native-host/audio_briefer_host.py"
WRAPPER_SCRIPT="$SCRIPT_DIR/native-host/run_host.sh"

echo "🎧 Read to Me - Installation"
echo "========================================"
echo ""

# Check for Python and validate version
echo "Checking requirements..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found!"
    echo ""
    echo "Install with:"
    echo "  brew install python@3.12"
    exit 1
fi

# Check Python version (need 3.10+)
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo "❌ Python $PYTHON_VERSION found, but 3.10+ is required"
    echo ""
    echo "macOS ships with Python 3.9 which doesn't support piper-tts."
    echo ""
    echo "Install Python 3.12 with:"
    echo "  brew install python@3.12"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✓ Python $PYTHON_VERSION found"

# Step 1: Set up Python venv if needed
VENV_DIR="$SCRIPT_DIR/native-host/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo "Setting up Python virtual environment..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --quiet piper-tts pathvalidate
    echo "✓ Installed Piper TTS"
else
    echo "✓ Python venv already exists"
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

# Step 3: Create wrapper script (activates venv and runs host)
echo ""
echo "Creating host wrapper script..."
cat > "$WRAPPER_SCRIPT" << 'EOF'
#!/bin/bash
# Wrapper to run the native host with the correct Python venv
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/.venv/bin/python" "$SCRIPT_DIR/audio_briefer_host.py"
EOF
chmod +x "$WRAPPER_SCRIPT"
chmod +x "$HOST_SCRIPT"
echo "✓ Created wrapper script"

# Step 4: Get Chrome extension ID
echo ""
echo "📋 IMPORTANT: You need your Chrome extension ID"
echo ""
echo "1. Open Chrome and go to: chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked' and select:"
echo "   $SCRIPT_DIR/extension"
echo "4. Copy the 'ID' shown under the extension name"
echo ""
read -p "Enter your extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo "❌ Extension ID is required"
    exit 1
fi

# Step 5: Create native messaging manifest (points directly to repo, no sudo needed)
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Read to Me - Convert articles to audio",
  "path": "$WRAPPER_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✓ Registered native messaging host"

# Step 6: Create output directory
mkdir -p "$HOME/Downloads/audio-briefings"
echo "✓ Created output directory: ~/Downloads/audio-briefings"

echo ""
echo "========================================"
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Reload the extension in Chrome (chrome://extensions/)"
echo "2. Visit any article page"
echo "3. Click the extension icon"
echo "4. Hit 'Generate Audio'"
echo ""
echo "Audio files will be saved to:"
echo "   ~/Downloads/audio-briefings/"
echo ""
echo "If you see errors, check:"
echo "   ~/Downloads/audio-briefings/error.log"
echo ""
