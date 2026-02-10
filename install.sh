#!/bin/bash
#
# Audio Webpage Briefer - Installation Script
#
# This script:
# 1. Installs the native messaging host
# 2. Registers it with Chrome
# 3. Creates output directory
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.claudebot.audio_briefer"

echo "🎧 Audio Webpage Briefer - Installation"
echo "========================================"
echo ""

# Check for required tools
echo "Checking requirements..."

if ! command -v sag &> /dev/null; then
    echo "❌ sag (ElevenLabs TTS) not found!"
    echo "   Install with: brew tap openclaw/tap && brew install sag"
    echo "   Or: npm install -g @openclaw/sag"
    exit 1
fi
echo "✓ sag found at $(which sag)"

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found!"
    exit 1
fi
echo "✓ Python 3 found"

# Check for API keys
ENV_FILE="$SCRIPT_DIR/native-host/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "⚠️  No .env file found. Creating one..."
    echo ""
    
    read -p "Enter your Anthropic API key: " ANTHROPIC_KEY
    if [ -z "$ANTHROPIC_KEY" ]; then
        echo "❌ Anthropic API key is required"
        exit 1
    fi
    
    echo "ANTHROPIC_API_KEY=$ANTHROPIC_KEY" > "$ENV_FILE"
    echo "✓ Created .env file"
fi

# Step 1: Copy native host script
echo ""
echo "Installing native messaging host..."
sudo cp "$SCRIPT_DIR/native-host/audio_briefer_host.py" /usr/local/bin/audio-briefer-host.py
sudo chmod 755 /usr/local/bin/audio-briefer-host.py
echo "✓ Installed to /usr/local/bin/audio-briefer-host.py"

# Step 2: Get Chrome extension ID
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

# Step 3: Create native messaging manifest
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

# Update manifest with extension ID
cat > "$MANIFEST_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Audio Webpage Briefer - Summarize pages and generate audio",
  "path": "/usr/local/bin/audio-briefer-host.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✓ Registered native messaging host"

# Step 4: Create output directory
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
echo "4. Hit 'Generate Briefing'"
echo ""
echo "Audio files will be saved to:"
echo "   ~/Downloads/audio-briefings/"
echo ""
