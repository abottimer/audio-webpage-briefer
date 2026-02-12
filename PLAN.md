# PLAN.md — Audio Webpage Briefer

*Last updated: 2026-02-12*

---

## Current Phase: Launched ✅

Public release complete. Extension works, demo video posted, announced on Twitter.

---

## Completed ✅

- [x] Core extension (popup, content script, background)
- [x] Native host with Piper TTS
- [x] Streaming playback (chunks play as generated)
- [x] One-click install script
- [x] Readability.js integration
- [x] Download to ~/Downloads/audio-briefings/
- [x] Demo video
- [x] Public GitHub release
- [x] Twitter announcement

---

## Future Ideas 💡

These are nice-to-haves, not committed:

- [ ] **AI summarization mode** — Claude integration for "give me the 2-minute version"
- [ ] **Quick/Deep summary options** — Choose brevity level
- [ ] **Better playback controls** — Speed adjustment, skip forward/back
- [ ] **Safari extension port** — Broader reach
- [ ] **Linux support** — Should be easy, Piper works on Linux
- [ ] **Voice selection** — Let users pick different Piper voices

---

## Known Issues 🐛

- macOS-only (Python native host setup)
- Requires manual extension ID entry during install
- Some sites with weird HTML don't extract cleanly

---

## Metrics

- GitHub stars: TBD
- Twitter engagement: TBD

---

## Notes

- This is a **portfolio piece** for Ashley Bottimer persona
- Keep it polished but don't over-engineer
- Good candidate for blog post: "Building a Local TTS Chrome Extension"
