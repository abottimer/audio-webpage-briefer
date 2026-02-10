# Audio Webpage Briefer - Quick Start Guide

Follow these steps in order. Should take about 5 minutes.

---

## Step 1: Check Piper is installed

You should already have Piper from your morning briefing setup. Verify:

```bash
which piper
```

If not found, install it:
```bash
brew install piper
```

---

## Step 2: Check you have a voice model

```bash
ls ~/.local/share/piper/
```

You should see `en_US-lessac-medium.onnx` (or similar). If not:

```bash
mkdir -p ~/.local/share/piper
curl -L 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx' \
  -o ~/.local/share/piper/en_US-lessac-medium.onnx
curl -L 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json' \
  -o ~/.local/share/piper/en_US-lessac-medium.onnx.json
```

---

## Step 3: Download Readability.js

```bash
cd /Users/ronnierocha/Documents/ClaudeAssistant/ideas/2026-01-29-audio-webpage-briefer/project/extension/lib

curl -sL "https://raw.githubusercontent.com/mozilla/readability/main/Readability.js" -o Readability.js
```

Verify it downloaded:
```bash
head -5 Readability.js
```

Should show JavaScript code, not a 404 error.

---

## Step 4: Load the extension in Chrome

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right corner)
4. Click "Load unpacked"
5. Navigate to and select:
   `/Users/ronnierocha/Documents/ClaudeAssistant/ideas/2026-01-29-audio-webpage-briefer/project/extension`
6. Note the **Extension ID** that appears (looks like: `abcdefghijklmnopqrstuvwxyz`)

---

## Step 5: Run the install script

```bash
cd /Users/ronnierocha/Documents/ClaudeAssistant/ideas/2026-01-29-audio-webpage-briefer/project

chmod +x install.sh
./install.sh
```

The script will:
- Ask for your Extension ID (from Step 4)
- Ask for your Anthropic API key (you can skip and add later)
- Install the native messaging host
- Register it with Chrome

---

## Step 6: Reload and test

1. Go back to `chrome://extensions/`
2. Click the refresh icon on the Audio Webpage Briefer extension
3. Visit any article (try: https://www.theverge.com or any news site)
4. Click the extension icon in Chrome toolbar
5. Click "Generate Briefing"

Audio will save to: `~/Downloads/audio-briefings/`

---

## Troubleshooting

### Extension icon not showing?
- Pin it: Click the puzzle piece icon in Chrome toolbar → Pin "Audio Webpage Briefer"

### "Native host disconnected" error?
- Re-run `./install.sh`
- Make sure the Extension ID matches

### "Could not extract article" error?
- Make sure you're on an actual article page, not a homepage
- Try a different article

### No audio generated?
- Check `~/Downloads/audio-briefings/` for error logs
- Verify Piper works: `echo "test" | piper --model ~/.local/share/piper/en_US-lessac-medium.onnx --output_file /tmp/test.wav`

---

## You're done! 🎧

Visit any article, click the extension, hit Generate. Enjoy your audio briefings.
