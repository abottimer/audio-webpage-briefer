#!/bin/bash
#
# Audio Webpage Briefer - Installation Script
#
# This script:
# 1. Sets up the Python venv with Piper TTS
# 2. Installs the native messaging host
# 3. Registers it with Chrome
# 4. Creates output directory
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.claudebot.audio_briefer"

echo "🎧 Read to Me - Installation"
echo "========================================"
echo ""

# Check for required tools
echo "Checking requirements..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found!"
    exit 1
fi
echo "✓ Python 3 found"

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
    echo "Downloading Piper voice model..."
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

# Step 3: Copy native host script
echo ""
echo "Installing native messaging host..."
sudo cp "$SCRIPT_DIR/native-host/audio_briefer_host.py" /usr/local/bin/audio-briefer-host.py
sudo chmod 755 /usr/local/bin/audio-briefer-host.py
echo "✓ Installed to /usr/local/bin/audio-briefer-host.py"

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

# Step 5: Create native messaging manifest
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Read to Me - Convert articles to audio",
  "path": "/usr/local/bin/audio-briefer-host.py",
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
