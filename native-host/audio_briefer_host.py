#!/usr/bin/env python3
"""
Audio Webpage Briefer - Native Messaging Host

Converts webpage article text to speech using Piper TTS.
V1: Full text read-aloud (no summarization)
"""

import json
import struct
import sys
import subprocess
import os
from datetime import datetime
from pathlib import Path

# Configuration
SCRIPT_DIR = Path(__file__).parent
VENV_PYTHON = SCRIPT_DIR / ".venv" / "bin" / "python"
PIPER_MODEL = Path.home() / ".local/share/piper/en_US-lessac-medium.onnx"
OUTPUT_DIR = Path.home() / "Downloads/audio-briefings"


def send_message(message: dict):
    """Send a message to the extension."""
    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def read_message():
    """Read a message from the extension."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def generate_audio(text: str, title: str, config: dict) -> tuple[str, str]:
    """Generate audio using Piper TTS."""

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate filename from title + timestamp
    safe_title = "".join(c for c in title[:30] if c.isalnum() or c in " -_").strip()
    safe_title = safe_title.replace(" ", "_") or "article"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = OUTPUT_DIR / f"{safe_title}_{timestamp}.wav"

    # Get speed setting (length_scale: lower = faster, 0.7 = 30% faster)
    length_scale = config.get('lengthScale', 0.7)

    try:
        result = subprocess.run(
            [
                str(VENV_PYTHON), "-m", "piper",
                "--model", str(PIPER_MODEL),
                "--length_scale", str(length_scale),
                "--output_file", str(output_path)
            ],
            input=text,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout for long articles
        )

        if result.returncode != 0:
            raise Exception(f"Piper failed: {result.stderr}")

        # Estimate duration
        word_count = len(text.split())
        adjusted_wpm = 150 / length_scale  # ~214 wpm at 0.7 scale
        duration_mins = word_count / adjusted_wpm
        
        if duration_mins < 1:
            duration_str = f"{int(duration_mins * 60)}s"
        else:
            duration_str = f"{int(duration_mins)}:{int((duration_mins % 1) * 60):02d}"

        return str(output_path), duration_str, word_count

    except subprocess.TimeoutExpired:
        raise Exception("Audio generation timed out (article may be too long)")
    except Exception as e:
        raise Exception(f"Audio generation failed: {str(e)}")


def main():
    """Main loop - process messages from the extension."""

    while True:
        message = read_message()
        if message is None:
            break

        try:
            if message.get('action') == 'generate':
                article = message.get('article', {})
                config = message.get('config', {})
                
                text = article.get('content', '')
                title = article.get('title', 'Article')

                if not text or len(text.strip()) < 50:
                    raise Exception("Not enough text content to read")

                # Progress update
                word_count = len(text.split())
                send_message({
                    "status": "progress",
                    "message": f"Generating audio for {word_count:,} words..."
                })

                audio_path, duration, words = generate_audio(text, title, config)

                # Success!
                send_message({
                    "status": "success",
                    "audioPath": audio_path,
                    "duration": duration,
                    "wordCount": words
                })

            else:
                send_message({
                    "status": "error",
                    "message": f"Unknown action: {message.get('action')}"
                })

        except Exception as e:
            send_message({
                "status": "error",
                "message": str(e)
            })


if __name__ == "__main__":
    main()
