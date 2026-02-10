# Read to Me

Chrome extension that converts any article to audio using local text-to-speech.

## Demo

https://github.com/abottimer/audio-webpage-briefer/raw/main/demo.mp4

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

```bash
git clone https://github.com/abottimer/audio-webpage-briefer.git
cd audio-webpage-briefer
chmod +x install.sh
./install.sh
```

The install script will:
1. Find Python 3.10+ (or tell you to install it)
2. Create a venv and install Piper TTS
3. Download the voice model (~100MB)
4. Configure the native messaging host
5. Prompt you for your Chrome extension ID

To get your extension ID:
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the `extension` folder
4. Copy the ID shown under the extension name

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
