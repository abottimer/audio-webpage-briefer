# AGENTS.md — Audio Webpage Briefer

## What Is This?

Chrome extension that converts articles to audio using **local TTS** (Piper). No cloud, no API keys, full privacy. Streaming playback starts immediately.

**Status:** Public / Launched (2026-02-10)

**Published as:** Ashley Bottimer (@AshBottimer)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Chrome Ext     │────▶│  Native Host     │────▶│  Piper TTS      │
│  (popup + bg)   │     │  (Python)        │     │  (local model)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        ▼                        ▼
   Readability.js          Streaming WAV
   (article extract)       (chunked playback)
```

## Key Files

| File | Purpose |
|------|---------|
| `extension/popup.js` | UI + playback controls |
| `extension/background.js` | Native messaging bridge |
| `extension/content.js` | Article extraction |
| `native-host/audio_briefer_host.py` | TTS generation + streaming |
| `install.sh` | One-click setup |

## Technical Notes

- **Piper TTS:** Local neural TTS, ~100MB voice model
- **Streaming:** Audio chunks sent as they're generated (base64 encoded)
- **Playback:** Web Audio API for seamless chunk playback
- **Extraction:** Readability.js strips ads/nav/footers

## Conventions

- Keep it simple — one feature, done well
- Local-first: no cloud dependencies
- Privacy-focused: nothing leaves the machine
- macOS-only for now (could port to Linux easily)

## Repo

- **GitHub:** https://github.com/abottimer/audio-webpage-briefer (PUBLIC)
- **Visibility:** Public — this is a portfolio piece

## Coordination

Check `PLAN.md` for roadmap and future ideas.
