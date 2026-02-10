#!/usr/bin/env python3
"""
Audio Webpage Briefer - Native Messaging Host

This script receives article content from the Chrome extension,
summarizes it using Claude, and generates audio using sag (ElevenLabs TTS).
"""

import json
import struct
import sys
import subprocess
import os
from datetime import datetime
from pathlib import Path

# Configuration
SAG_PATH = "/opt/homebrew/bin/sag"  # ElevenLabs TTS CLI
OUTPUT_DIR = os.path.expanduser("~/Downloads/audio-briefings")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Try to load from .env if not in environment
if not ANTHROPIC_API_KEY:
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith("ANTHROPIC_API_KEY="):
                    ANTHROPIC_API_KEY = line.strip().split("=", 1)[1].strip('"\'')
                    break


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


def summarize_with_claude(article: dict, mode: str) -> str:
    """Use Claude to generate a conversational summary."""

    if mode == 'quick':
        word_target = "150-250 words (about 1-2 minutes when spoken)"
    else:  # deep
        word_target = "400-600 words (about 3-5 minutes when spoken)"

    prompt = f"""You are a helpful personal assistant briefing me on an article I want to understand.

Your task: Summarize this article in a conversational, podcast-style tone. Imagine you're telling a friend about what you just read.

Guidelines:
- Start with "Here's what this article is about..." or similar natural opener
- Focus on the KEY POINTS - the meaty, important bits
- Skip filler, repetition, and fluff
- Use natural transitions like "What's interesting is...", "The main takeaway is...", "One thing worth noting..."
- End with a brief "bottom line" or main insight
- Target length: {word_target}
- Write for SPOKEN delivery - use contractions, conversational phrasing
- Don't say "the article says" repeatedly - just convey the information naturally

Article Title: {article.get('title', 'Unknown')}
Article URL: {article.get('url', '')}

Article Content:
{article.get('content', '')[:15000]}

Now provide the conversational summary:"""

    try:
        # Use anthropic SDK if available, otherwise fall back to curl
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except ImportError:
            # Fall back to curl
            payload = {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}]
            }

            result = subprocess.run(
                [
                    "curl", "-s", "https://api.anthropic.com/v1/messages",
                    "-H", f"x-api-key: {ANTHROPIC_API_KEY}",
                    "-H", "anthropic-version: 2023-06-01",
                    "-H", "content-type: application/json",
                    "-d", json.dumps(payload)
                ],
                capture_output=True,
                text=True
            )

            response = json.loads(result.stdout)
            return response["content"][0]["text"]

    except Exception as e:
        raise Exception(f"Claude summarization failed: {str(e)}")


def generate_audio(text: str, config: dict) -> tuple[str, str]:
    """Generate audio using sag (ElevenLabs TTS)."""

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(OUTPUT_DIR, f"briefing_{timestamp}.mp3")

    try:
        # Use sag to generate audio
        # sag write "text" -o output.mp3
        result = subprocess.run(
            [
                SAG_PATH, "write", text,
                "-o", output_path,
                "--model", "eleven_flash_v2_5"  # Fast model for quick generation
            ],
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout
        )

        if result.returncode != 0:
            raise Exception(f"sag failed: {result.stderr}")

        # Estimate duration (rough: ~150 words per minute)
        word_count = len(text.split())
        duration_mins = word_count / 150
        duration_str = f"{int(duration_mins)}:{int((duration_mins % 1) * 60):02d}"

        return output_path, duration_str

    except subprocess.TimeoutExpired:
        raise Exception("Audio generation timed out")
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
                mode = message.get('mode', 'quick')
                config = message.get('config', {})

                # Step 1: Summarize
                send_message({
                    "status": "progress",
                    "message": "Summarizing with Claude..."
                })

                summary = summarize_with_claude(article, mode)

                # Step 2: Generate audio
                send_message({
                    "status": "progress",
                    "message": "Generating audio with ElevenLabs..."
                })

                audio_path, duration = generate_audio(summary, config)

                # Success!
                send_message({
                    "status": "success",
                    "audioPath": audio_path,
                    "duration": duration,
                    "summary": summary
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
