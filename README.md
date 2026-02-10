# Audio Webpage Briefer

Chrome extension that AI-summarizes any webpage and generates audio briefings using Piper TTS.

## Features

- **AI Summarization**: Uses Claude to create conversational summaries (not word-for-word reading)
- **Two Modes**: Quick (1-2 min) or Deep (3-5 min) briefings
- **Local TTS**: Fast, private audio generation with Piper (no cloud dependency)
- **Personal Assistant Tone**: "Here's what this article is about..." style briefings
- **30% Faster Speech**: Optimized for efficient listening

## Requirements

- macOS (Apple Silicon or Intel)
- Chrome browser
- Python 3.10+
- Anthropic API key (Claude)

## Installation

### 1. Clone and set up Python environment

```bash
git clone https://github.com/abottimer/audio-webpage-briefer.git
cd audio-webpage-briefer

# Create Python venv and install dependencies
python3 -m venv native-host/.venv
source native-host/.venv/bin/activate
pip install piper-tts pathvalidate anthropic
```

### 2. Download Piper voice model

```bash
mkdir -p ~/.local/share/piper
curl -L 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx' \
  -o ~/.local/share/piper/en_US-lessac-medium.onnx
curl -L 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json' \
  -o ~/.local/share/piper/en_US-lessac-medium.onnx.json
```

### 3. Set up API key

Create `native-host/.env`:

```bash
echo "ANTHROPIC_API_KEY=your-api-key-here" > native-host/.env
```

### 4. Load the Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Copy the Extension ID shown

### 5. Run the Install Script

```bash
chmod +x install.sh
./install.sh
# Enter your extension ID when prompted
```

## Usage

1. Visit any article or blog post
2. Click the Audio Briefer extension icon
3. Choose Quick (1-2 min) or Deep (3-5 min) mode
4. Click "Generate Briefing"
5. Audio saves to `~/Downloads/audio-briefings/`

## How It Works

1. **Extract**: Readability.js pulls the article content from the page
2. **Summarize**: Claude creates a conversational summary in "personal assistant" style
3. **Speak**: Piper TTS generates natural-sounding audio locally
4. **Save**: Audio file is saved for playback

## Project Structure

```
audio-webpage-briefer/
├── extension/
│   ├── manifest.json      # Chrome extension manifest (Manifest V3)
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   ├── content.js         # Page content extraction
│   ├── background.js      # Native messaging bridge
│   ├── lib/
│   │   └── Readability.js # Mozilla's article extraction
│   └── icons/
├── native-host/
│   ├── audio_briefer_host.py  # Python native messaging host
│   ├── com.claudebot.audio_briefer.json  # Host manifest
│   ├── .venv/             # Python virtual environment
│   └── .env               # API keys (create this)
├── install.sh             # Installation script
└── README.md
```

## Configuration

### Speed Adjustment

Default is `length_scale: 0.7` (30% faster than normal). Edit in the config or background.js.

### Voice Selection

Uses `en_US-lessac-medium` by default. Other voices available at:
https://huggingface.co/rhasspy/piper-voices

## License

MIT
