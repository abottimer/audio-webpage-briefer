# Audio Webpage Briefer

Chrome extension that AI-summarizes any webpage and generates audio briefings using ElevenLabs TTS.

## Features

- **AI Summarization**: Uses Claude to create conversational summaries (not word-for-word reading)
- **Two Modes**: Quick (1-2 min) or Deep (3-5 min) briefings
- **Premium TTS**: Natural-sounding audio with ElevenLabs
- **Personal Assistant Tone**: "Here's what this article is about..." style briefings

## Requirements

- macOS
- Chrome browser
- [sag](https://github.com/openclaw/sag) CLI (ElevenLabs TTS wrapper)
- Anthropic API key (Claude)
- ElevenLabs API key (for sag)

## Installation

### 1. Install sag (ElevenLabs TTS)

```bash
brew tap openclaw/tap
brew install sag
```

Or via npm:
```bash
npm install -g @openclaw/sag
```

### 2. Set up API keys

Create a `.env` file in the `native-host` folder:

```bash
ANTHROPIC_API_KEY=your-anthropic-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Note the Extension ID that appears

### 4. Run the Install Script

```bash
chmod +x install.sh
./install.sh
```

This will:
- Install the native messaging host
- Register it with Chrome
- Create the output directory

## Usage

1. Visit any article or blog post
2. Click the Audio Briefer extension icon
3. Choose Quick (1-2 min) or Deep (3-5 min) mode
4. Click "Generate Briefing"
5. Audio file saves to `~/Downloads/audio-briefings/`

## How It Works

1. **Extract**: Readability.js pulls the article content from the page
2. **Summarize**: Claude creates a conversational summary in "personal assistant" style
3. **Speak**: ElevenLabs generates natural-sounding audio
4. **Save**: Audio file is saved locally for playback

## Project Structure

```
audio-webpage-briefer/
├── extension/
│   ├── manifest.json      # Chrome extension manifest
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
│   └── .env               # API keys (create this)
├── install.sh             # Installation script
└── README.md
```

## License

MIT
