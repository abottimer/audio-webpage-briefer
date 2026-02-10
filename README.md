# Read to Me

Chrome extension that converts any article to audio using local text-to-speech.

## Features

- **Instant streaming**: Audio starts playing immediately — no waiting for full generation
- **Playback controls**: Play, pause, stop right in the popup
- **Download option**: Save audio files for offline listening
- **Local TTS**: Fast, private audio generation with Piper (no cloud/API needed)
- **30% faster speech**: Optimized for efficient listening
- **Clean extraction**: Uses Readability.js to pull just the article content

## Requirements

- macOS (Apple Silicon or Intel)
- Chrome browser
- Python 3.10+

## Installation

### 1. Clone and set up Python environment

```bash
git clone https://github.com/abottimer/audio-webpage-briefer.git
cd audio-webpage-briefer

# Create Python venv and install dependencies
python3 -m venv native-host/.venv
source native-host/.venv/bin/activate
pip install piper-tts pathvalidate
```

### 2. Download Piper voice model

```bash
mkdir -p ~/.local/share/piper
curl -L 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx' \
  -o ~/.local/share/piper/en_US-lessac-medium.onnx
curl -L 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json' \
  -o ~/.local/share/piper/en_US-lessac-medium.onnx.json
```

### 3. Load the Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Copy the Extension ID shown

### 4. Run the Install Script

```bash
chmod +x install.sh
./install.sh
# Enter your extension ID when prompted
```

## Usage

1. Visit any article or blog post
2. Click the "Read to Me" extension icon
3. Click **Play** to start streaming audio immediately
4. Use **Pause/Stop** to control playback
5. Click **💾** to download a copy to `~/Downloads/audio-briefings/`

## How It Works

1. **Extract**: Readability.js pulls the article text (no ads, navs, footers)
2. **Stream**: Piper TTS generates audio and streams chunks in real-time
3. **Play**: Web Audio API plays chunks as they arrive — no waiting!
4. **Download** (optional): Save WAV file to Downloads for offline playback

## Future Ideas

- [ ] AI summarization mode (Claude integration)
- [ ] Quick/Deep summary options
- [ ] Playback controls in popup
- [ ] Safari extension port

## Project Structure

```
audio-webpage-briefer/
├── extension/
│   ├── manifest.json
│   ├── popup.html / popup.js
│   ├── content.js
│   ├── background.js
│   └── lib/Readability.js
├── native-host/
│   ├── audio_briefer_host.py
│   └── .venv/
├── install.sh
└── README.md
```

## Troubleshooting

### "Native host has exited" error?
1. Check the error log: `cat ~/Downloads/audio-briefings/error.log`
2. Re-run `./install.sh`
3. Make sure the Extension ID matches

### Extension icon not showing?
- Pin it: Click the puzzle piece icon in Chrome toolbar → Pin "Read to Me"

### "Could not extract article" error?
- Make sure you're on an actual article page, not a homepage
- Try a different article

### Python version issues?
- macOS ships with Python 3.9.6 which doesn't work with piper-tts
- Install Python 3.12: `brew install python@3.12`
- Re-run `./install.sh`

## License

MIT
